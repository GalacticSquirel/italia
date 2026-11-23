"""Round 9, step 1: a ~2,500-turn subset of round-8 train items, stratified by level and gold move,
for on-policy sampling. Skips turns whose reference turn breaks its own plan (its move differs
from the gold move), since the reference is the "chosen" answer.
usage (from training/): r9_subset.py train-items.jsonl subset.jsonl"""

import json
import random
import sys
from collections import Counter, defaultdict
from pathlib import Path

from datagen.filters import parse_tutor_output
from datagen.jsonutil import read_jsonl

TOTAL = 2500
SHARE = {"none": 0.4, "prompt": 0.3, "recast": 0.3}  # correction turns oversampled vs ~64% none
rng = random.Random(20261120)
cells: dict[tuple[str, str], list[dict]] = defaultdict(list)
skipped = 0
for row in read_jsonl(Path(sys.argv[1])):
    ref, _ = parse_tutor_output(row["reference"])
    move = row["gold"]["expectedMove"]
    if ref is None or ref.annotations.move != move:
        skipped += 1
        continue
    cells[(row["level"], move)].append(row)
levels = sorted({lv for lv, _ in cells})
per_level = TOTAL // len(levels)
picked: list[dict] = []
counts: Counter[tuple[str, str]] = Counter()
for lv in levels:
    for move, share in SHARE.items():
        pool = cells.get((lv, move), [])
        take = min(len(pool), round(per_level * share))
        chosen = rng.sample(pool, take)
        picked += chosen
        counts[(lv, move)] = take
rng.shuffle(picked)
with open(sys.argv[2], "w", encoding="utf-8") as out:
    for row in picked:
        out.write(json.dumps(row, ensure_ascii=False) + "\n")
print(f"skipped (reference breaks plan) {skipped}; picked {len(picked)}")
for lv in levels:
    print(f"  {lv}: " + ", ".join(f"{m} {counts[(lv, m)]}/{len(cells.get((lv, m), []))}" for m in SHARE))
