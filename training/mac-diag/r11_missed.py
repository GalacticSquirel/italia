"""Round 11: on-policy missed-correction pairs. On train turns where gold corrects (prompt/recast)
and a round10m sample gives no correction, chosen = gold, rejected = that sample. One per turn;
TARGET pairs stratified evenly by level.
usage (from training/): r11_missed.py subset.jsonl samples.jsonl out.jsonl"""

import json
import random
import sys
from collections import Counter
from pathlib import Path

from datagen.filters import parse_tutor_output
from datagen.jsonutil import read_jsonl
from eval.items import EvalItem

TARGET = 100
SYSTEMS = ("r11-s1", "r11-s2", "r11-s3", "r11-s4")
rng = random.Random(20261125)
items = [EvalItem.model_validate(r) for r in read_jsonl(Path(sys.argv[1]))]
samples: dict[str, list[str]] = {}
for r in read_jsonl(Path(sys.argv[2])):
    if r["system"] in SYSTEMS:
        samples.setdefault(r["itemId"], []).append(r["text"])
pool: dict[str, list[dict]] = {}
for item in items:
    if item.gold.expected_move == "none":
        continue
    misses = []
    for t in dict.fromkeys(samples.get(item.id, [])):
        p, _ = parse_tutor_output(t)
        if p is not None and p.annotations.move == "none":
            misses.append(t)
    if misses:
        pool.setdefault(item.level.value, []).append({
            "id": item.id, "kind": "missed", "level": item.level.value,
            "move": item.gold.expected_move, "prompt": item.messages,
            "chosen": [{"role": "assistant", "content": item.reference}],
            "rejected": [{"role": "assistant", "content": rng.choice(misses)}]})
levels = sorted(pool)
picked = []
for lv in levels:
    picked += rng.sample(pool[lv], min(len(pool[lv]), TARGET // len(levels)))
rest = [p for lv in levels for p in pool[lv] if p not in picked]
picked += rng.sample(rest, min(len(rest), TARGET - len(picked)))
with open(sys.argv[3], "w", encoding="utf-8") as out:
    for p in picked:
        out.write(json.dumps(p, ensure_ascii=False) + "\n")
print(f"missed candidates by level: { {lv: len(pool[lv]) for lv in levels} }; kept {len(picked)}: "
      f"{dict(Counter(p['level'] for p in picked))}")
