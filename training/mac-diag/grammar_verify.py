"""Second pass: ask the judge to confirm each flag from grammar_probe.py --v2 as a yes/no question.
usage (from training/): grammar_verify.py in.jsonl out.jsonl"""

import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from datagen.config import load_config
from datagen.jsonutil import extract_json_object
from datagen.teacher import make_client

VERIFY = """A proofreader claims there is a mistake in this Italian sentence, written by a tutor
in a role-play lesson ({register}; the learner is {gender}).

Sentence: <s>{reply}</s>
Claimed mistake: "{quote}"  ->  suggested: "{fix}"

Is the original text definitely wrong in standard Italian (ungrammatical, wrong agreement or verb
form, wrong auxiliary or preposition, misspelled), so that a native speaker would correct it in
any context? Answer "false" if it is correct but could be phrased differently, if it repeats a
learner's words on purpose, or if it is only a tu/Lei or style choice.

Answer with JSON only: {{"definitelyWrong": true}} or {{"definitelyWrong": false}}"""

cfg = load_config(Path("datagen/configs/local-mac.yaml"))
client = make_client(cfg.judge_endpoint)
rows = [json.loads(line) for line in open(sys.argv[1])]


def verify(row: dict) -> dict:
    ctx = row["ctx"]
    kept = []
    for f in row["flags"]:
        c = client.complete(
            [{"role": "user", "content": VERIFY.format(
                register="formal, Lei" if ctx["formality"] == "formal" else "informal, tu",
                gender="female" if ctx["gender"] == "f" else "male",
                reply=row["reply"], quote=f["quote"], fix=f["fix"])}],
            temperature=0.0, max_tokens=40, json_output=True,
        )
        try:
            ok = bool(extract_json_object(c.text).get("definitelyWrong"))
        except Exception:  # noqa: BLE001
            ok = True  # keep the flag if the answer is unreadable
        if ok:
            kept.append(f)
    return {**row, "model": row["model"] + " (verified)", "flags_unverified": row["flags"],
            "flags": kept}


with ThreadPoolExecutor(4) as pool, open(sys.argv[2], "w") as out:
    for r in pool.map(verify, rows):
        out.write(json.dumps(r, ensure_ascii=False) + "\n")
print("verified ->", sys.argv[2])
