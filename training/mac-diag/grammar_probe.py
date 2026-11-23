"""Per-turn grammar pass: recall on planted errors, false flags on accepted dialogues.

usage (from training/, judge endpoint set via LOCAL_JUDGE_URL / LOCAL_JUDGE_MODEL):
    python grammar_probe.py <out.jsonl>
Writes one row per checked tutor turn: kind (planted/clean), reply, model flags (after the
deterministic cleanup), raw flags, and LanguageTool spans.
"""

import json
import re
import sys
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from datagen.config import load_config
from datagen.jsonutil import extract_json_object
from datagen.__main__ import grammar_checker
from datagen.records import DialogueRecord
from datagen.teacher import make_client

PLANTED = [
    "Quale fermata deve scendere?",  # A quale fermata
    "E ci sono un balcone o un giardino?",  # c'è un balcone
    "La cucina piccolo? Si dice: la cucina piccola. Ripeti!",  # gives the answer (feedback)
    "Ieri ho andato al mercato con mia sorella.",  # sono andato
    "Il problema e che la machina non parte.",  # è, macchina
    "Mi piace molto questa città, è molto belle.",  # bella
]
N_CLEAN = 20
V2 = "--v2" in sys.argv
START = int(next((a.split('=')[1] for a in sys.argv if a.startswith('--start=')), 10))

PROMPT = """You are a strict native Italian proofreader checking one reply written by an Italian
tutor in a role-play lesson.

Learner's previous turn (may contain mistakes; ignore its errors):
<learner>{learner}</learner>

Tutor's reply to check:
<reply>{reply}</reply>

List every word or phrase in the tutor's reply that is wrong in standard Italian: grammar,
agreement (gender/number), verb forms, auxiliary (essere/avere), missing or wrong prepositions or
articles, spelling, accents and apostrophes. A tutor may deliberately repeat the learner's wrong
words as a question to make them self-correct; do not list text copied from the learner's turn.
Do not list style, register or word-choice preferences: only real mistakes.

Answer with JSON only:
{{"errors": [{{"quote": "<exact wrong text from the reply>", "fix": "<corrected text>"}}]}}
Use {{"errors": []}} when the reply has no mistakes."""

PROMPT_V2 = """You are a strict native Italian proofreader checking one reply written by an Italian
tutor in a role-play lesson.

Scene: {setting} The tutor plays {tutor_role}; the learner plays {learner_role}.
Register: {register}
The learner is {gender}: adjectives and participles that refer to the learner must be {gender_form}.

What the learner has said so far (may contain mistakes; ignore them):
<learner>{learner}</learner>

Tutor's reply to check:
<reply>{reply}</reply>

List only definite mistakes in the tutor's reply, things a native speaker would call wrong in any
context: grammar, agreement, verb forms, auxiliary (essere/avere), missing or wrong prepositions or
articles, spelling, accents and apostrophes.
Do NOT list:
- text the tutor repeats from the learner (a prompt deliberately echoes the learner's mistake);
- the choice of tu or Lei (the register above is required);
- more natural, more formal or alternative wordings of something that is already correct;
- agreement with people other than the learner whose gender the reply does not show.

Answer with JSON only:
{{"errors": [{{"quote": "<exact wrong text from the reply>", "fix": "<corrected text>"}}]}}
Use {{"errors": []}} when the reply has no definite mistakes."""


def norm(s: str) -> str:
    s = unicodedata.normalize("NFC", s).lower().replace("’", "'")
    return re.sub(r"\s+", " ", re.sub(r"[^\w' ]", " ", s)).strip()


def cleanup(flags: list[dict], reply: str, learner: str) -> list[dict]:
    out = []
    for f in flags:
        q, fix = str(f.get("quote", "")), str(f.get("fix", ""))
        if not norm(q) or norm(q) not in norm(reply):
            continue  # not actually in the reply (hallucinated)
        if learner and norm(q) in norm(learner):
            continue  # copied from the learner on purpose
        if norm(q) == norm(fix):
            continue  # "correction" changes nothing
        out.append({"quote": q, "fix": fix})
    return out


def main() -> None:
    cfg = load_config(Path("datagen/configs/local-mac.yaml"))
    client = make_client(cfg.judge_endpoint)
    lt = grammar_checker(cfg)
    rows = [json.loads(line) for line in open("work/datagen/local-v1/judged.jsonl")]
    items = []
    def item(kind: str, rec: DialogueRecord, i: int, reply: str, **extra: object) -> dict:
        prev = rec.turns[i - 1].text if i > 0 and rec.turns[i - 1].output is None else ""
        so_far = [t.text or "" for t in rec.turns[:i] if t.output is None]
        sc = rec.context.scenario
        return {"kind": kind, "dialogue": rec.id, "turn": i, "reply": reply,
                "learner": prev or "", "learner_all": so_far, **extra,
                "ctx": {"setting": sc.setting, "tutor_role": sc.tutor_role,
                        "learner_role": sc.learner_role, "formality": sc.formality,
                        "gender": rec.persona.gender}}

    for k, text in enumerate(PLANTED):
        rec = DialogueRecord.model_validate(rows[k])
        i = max(j for j, t in enumerate(rec.turns) if t.output is not None)
        items.append(item("planted", rec, i, text, case=k))
    for rec in (DialogueRecord.model_validate(r) for r in rows[START : START + N_CLEAN]):
        for i, t in enumerate(rec.turns):
            if t.output is not None:
                items.append(item("clean", rec, i, t.output.reply))

    def check(item: dict) -> dict:
        if V2:
            ctx = item["ctx"]
            content = PROMPT_V2.format(
                setting=ctx["setting"], tutor_role=ctx["tutor_role"],
                learner_role=ctx["learner_role"],
                register=("formal: the tutor addresses the learner with Lei"
                          if ctx["formality"] == "formal"
                          else "informal: the tutor addresses the learner with tu"),
                gender="female" if ctx["gender"] == "f" else "male",
                gender_form="feminine" if ctx["gender"] == "f" else "masculine",
                learner="\n".join(item["learner_all"]) or "(nothing yet)",
                reply=item["reply"])
        else:
            content = PROMPT.format(learner=item["learner"] or "(none)", reply=item["reply"])
        c = client.complete(
            [{"role": "user", "content": content}],
            temperature=0.0, max_tokens=400, json_output=True,
        )
        try:
            raw = extract_json_object(c.text).get("errors", [])
            raw = [f for f in raw if isinstance(f, dict)]
        except Exception:  # noqa: BLE001 - unparseable counts as a parse failure, kept visible
            raw = [{"quote": "<UNPARSEABLE>", "fix": c.text[:200]}]
        lt_spans = [m.span(item["reply"]) for m in lt.check(item["reply"])]
        return {**item, "model": client.name, "raw": raw,
                "flags": cleanup(raw, item["reply"],
                                 " || ".join(item["learner_all"]) if V2 else item["learner"]),
                "lt": lt_spans}

    with ThreadPoolExecutor(4) as pool, open(sys.argv[1], "w") as out:
        for row in pool.map(check, items):
            out.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(f"{len(items)} turns checked -> {sys.argv[1]}")


if __name__ == "__main__":
    main()
