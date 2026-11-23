"""Read-only: round12-dpo's bench misses at C1/C2. A miss = gold move prompt/recast and the model
gave no correction (the under-correction metric). Also lists "wrong span" items (the model
corrected, but a span with no word overlap with the gold span). Prints one line per item and
tag counts.
usage (from training/): misses.py system"""

import re
import sys
from collections import Counter
from pathlib import Path

from datagen.filters import parse_tutor_output
from datagen.jsonutil import read_jsonl
from eval.items import EvalItem

SYSTEM = sys.argv[1]
items = [EvalItem.model_validate(r) for r in read_jsonl(Path("work/eval/bench.jsonl"))]
preds = {r["itemId"]: r["text"] for r in read_jsonl(Path("work/eval/bench-predictions.jsonl"))
         if r["system"] == SYSTEM}


def words(s):
    return set(re.sub(r"[^\w\s]", " ", (s or "").lower()).split())


def short(s, n=110):
    s = " ".join(s.split())
    return s if len(s) <= n else s[: n - 1] + "…"


for level in ("C2", "C1"):
    miss_tags, wrong_tags, lengths, miss_rows, wrong_rows = Counter(), Counter(), [], [], []
    due = 0
    for it in items:
        if it.level.value != level or it.gold.expected_move == "none":
            continue
        due += 1
        p, _ = parse_tutor_output(preds.get(it.id, ""))
        g = it.gold
        span = f"«{g.learner_span}» → «{g.corrected_span}»" if g.learner_span else "(no span)"
        if p is None:
            continue
        if p.annotations.move == "none":
            miss_tags[g.target_tag] += 1
            lengths.append(len(it.learner_text.split()))
            miss_rows.append(f"  [{g.target_tag}] {it.id} | learner: {short(it.learner_text)} | gold {g.expected_move} {span} | model: no correction; reply: {short(p.reply, 80)}")
        else:
            fb = p.annotations.prompt or p.annotations.recast
            if g.learner_span and not (words(fb.learner_text) & words(g.learner_span)):
                wrong_tags[g.target_tag] += 1
                wrong_rows.append(f"  [{g.target_tag}] {it.id} | learner: {short(it.learner_text)} | gold {span} | model: {p.annotations.move} on «{fb.learner_text}» tags {p.annotations.error_tags}")
    print(f"## {level}: due {due}, missed (no correction) {len(miss_rows)}, wrong-span corrections {len(wrong_rows)}")
    print(f"missed by tag: {dict(miss_tags.most_common())}")
    print(f"wrong-span by tag: {dict(wrong_tags.most_common())}")
    if lengths:
        print(f"learner-turn length of misses: mean {sum(lengths)/len(lengths):.0f} words (all {level} due turns: "
              f"{sum(len(i.learner_text.split()) for i in items if i.level.value == level and i.gold.expected_move != 'none') / due:.0f})")
    print("misses:")
    print("\n".join(miss_rows))
    print("wrong-span:")
    print("\n".join(wrong_rows))
    print()
