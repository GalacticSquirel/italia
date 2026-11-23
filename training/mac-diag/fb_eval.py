"""Measure datagen.feedback_check against the real judge: planted cases + unseen dialogues.
usage (from training/ of a checkout with the module): fb_eval.py judged.jsonl start"""

import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from datagen.config import load_config
from datagen.feedback_check import check_dialogue
from datagen.records import DialogueRecord
from datagen.teacher import make_client
from spec.models import Prompt, Recast, Turn

# (expected kind or None, learner message, move, tutor reply, learnerText, correctedText)
CASES = [
    ("reveals", "La cucina è piccolo ma ha una finestra.", "prompt",
     "La cucina piccolo? Si dice: la cucina piccola. Ripeti!", "è piccolo", None),
    ("reveals", "Ieri ho andato al mercato.", "prompt",
     "Ho andato? No, si dice sono andato. Prova di nuovo!", "ho andato", None),
    ("reveals", "Vorrei un caffè e un cornetti.", "prompt",
     "Un cornetti? Un cornetto, al singolare. Ripeti?", "un cornetti", None),
    ("corrects-correct", "Ieri sono andato al mercato.", "prompt",
     "Sono andato? Sei sicuro?", "sono andato", None),
    ("corrects-correct", "Vorrei una camera doppia per due notti.", "prompt",
     "Una camera doppia? Come si dice?", "una camera doppia", None),
    ("multiple", "Ieri io ho andato al la mercato.", "recast",
     "Ah, sei andato al mercato! Cosa hai comprato?", "ho andato", "sei andato"),
    ("multiple", "Ho mangiato un pizza e due caffe.", "prompt",
     "Un pizza? E si scrive caffè, con l'accento.", "un pizza", None),
    (None, "Ieri ho andato al mercato.", "prompt", "Ho andato? Sei sicuro?", "ho andato", None),
    (None, "Vorrei un caffè e un cornetti.", "prompt", "Un cornetti? Uno o tanti?",
     "un cornetti", None),
    (None, "Ieri ho andato al mercato.", "recast",
     "Ah, sei andato al mercato! Cosa hai comprato?", "ho andato", "sei andato"),
]

cfg = load_config(Path("datagen/configs/local-mac.yaml"))
client = make_client(cfg.judge_endpoint)
rows = [json.loads(line) for line in open(sys.argv[1])]
start = int(sys.argv[2])
base = next(
    DialogueRecord.model_validate(r) for r in rows
    if r["persona"]["gender"] == "m"
    and any(t.get("output") and t["output"]["annotations"]["prompt"] for t in r["turns"])
)
pi = next(i for i, t in enumerate(base.turns) if t.output and t.output.annotations.prompt)
tags = base.turns[pi].output.annotations.prompt.error_tags


def planted(case: tuple) -> tuple:
    kind, learner, move, reply, ltext, corrected = case
    turns = list(base.turns)
    turns[pi - 1] = Turn(role="learner", text=learner)
    ann = turns[pi].output.annotations.model_copy(update={
        "prompt": Prompt(learner_text=ltext, error_tags=tags) if move == "prompt" else None,
        "recast": (Recast(learner_text=ltext, corrected_text=corrected, error_tags=tags)
                   if move == "recast" else None),
    })
    out = turns[pi].output.model_copy(update={"reply": reply, "annotations": ann})
    turns[pi] = Turn(role="tutor", text=reply, output=out)
    problems, _ = check_dialogue(base.model_copy(update={"turns": turns}), client)
    return case, [p for p in problems if p.turn == pi]


def clean(rec: DialogueRecord) -> tuple:
    n = sum(1 for t in rec.turns if t.output and (t.output.annotations.prompt or t.output.annotations.recast))
    problems, _ = check_dialogue(rec, client)
    return rec, n, problems


with ThreadPoolExecutor(4) as pool:
    p = list(pool.map(planted, CASES))
    c = list(pool.map(clean, (DialogueRecord.model_validate(r) for r in rows[start:start + 20])))

hit = 0
for (kind, learner, move, reply, *_), probs in p:
    kinds = sorted({x.kind for x in probs})
    ok = (kind in kinds) if kind else not kinds
    hit += ok
    print(f"  {'OK ' if ok else 'MISS'} want={kind or 'nothing':16} got={kinds}  {move}: {reply!r}")
pos = sum(1 for k, *_ in CASES if k)
print(f"planted: {sum(ok for ok in [((k in sorted({x.kind for x in pr})) if k else not pr) for (k, *_), pr in p][:pos])}"
      f" / {pos} problems found, {sum(not pr for (k, *_), pr in p if not k)} / {len(CASES) - pos} negatives clean")
turns = sum(n for _, n, _ in c)
flagged = sum(len({x.turn for x in pr}) for _, _, pr in c)
print(f"clean: {flagged} / {turns} prompt/recast turns flagged, dialogues flagged "
      f"{sum(bool(pr) for *_, pr in c)} / 20")
for rec, _, pr in c:
    for x in pr:
        t = rec.turns[x.turn]
        print(f"  [{x.kind}] learner={rec.turns[x.turn - 1].text!r} reply={t.text!r} quote={x.quote!r}")
