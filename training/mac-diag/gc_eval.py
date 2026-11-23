"""Integrated datagen.grammar_check against the real judge: planted recall and clean flag rate.
usage (from training/ of the worktree): gc_eval.py judged.jsonl start"""

import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from datagen.config import load_config
from datagen.grammar_check import check_dialogue
from datagen.records import DialogueRecord
from datagen.teacher import make_client
from spec.models import Turn

PLANTED = [
    "Quale fermata deve scendere?",
    "E ci sono un balcone o un giardino?",
    "La cucina piccolo? Si dice: la cucina piccola. Ripeti!",
    "Ieri ho andato al mercato con mia sorella.",
    "Il problema e che la machina non parte.",
    "Mi piace molto questa città, è molto belle.",
]
cfg = load_config(Path("datagen/configs/local-mac.yaml"))
client = make_client(cfg.judge_endpoint)
rows = [json.loads(line) for line in open(sys.argv[1])]
start = int(sys.argv[2])


def planted(k: int) -> tuple[int, list]:
    rec = DialogueRecord.model_validate(rows[k])
    turns = list(rec.turns)
    i = max(j for j, t in enumerate(turns) if t.output is not None)
    out = turns[i].output.model_copy(update={"reply": PLANTED[k]})
    turns[i] = Turn(role="tutor", text=PLANTED[k], output=out)
    errors, _ = check_dialogue(rec.model_copy(update={"turns": turns}), client)
    return i, [e for e in errors if e.turn == i]


def clean(rec: DialogueRecord) -> tuple[int, list]:
    errors, _ = check_dialogue(rec, client)
    return sum(t.output is not None for t in rec.turns), errors


with ThreadPoolExecutor(4) as pool:
    p = list(pool.map(planted, range(len(PLANTED))))
    c = list(pool.map(clean, (DialogueRecord.model_validate(r) for r in rows[start : start + 20])))
for text, (_, errs) in zip(PLANTED, p, strict=True):
    print(f"  planted {text!r:58} -> {[(e.quote, e.fix) for e in errs]}")
turns = sum(n for n, _ in c)
flagged_turns = sum(len({e.turn for e in errs}) for _, errs in c)
print(f"planted caught: {sum(bool(e) for _, e in p)} / 6")
print(f"clean turns flagged: {flagged_turns} / {turns} ({100 * flagged_turns / turns:.0f}%), "
      f"dialogues flagged: {sum(bool(e) for _, e in c)} / 20")
for _, errs in c:
    for e in errs:
        print(f"  clean flag: {e.quote!r} -> {e.fix!r}")
