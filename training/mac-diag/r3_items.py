"""Round 3, step 1: eval-style items from every planned tutor reaction in round 2's SFT train
split (round-1 accepted dialogues + hand-written), so round 2 can be scored against gold on
its own training data. usage (from training/): r3_items.py out.jsonl work/sft-roundN/sft.train.jsonl"""

import json
import sys
from pathlib import Path

from datagen.handwritten import load_handwritten
from datagen.records import DialogueRecord
from datagen.jsonutil import read_jsonl
from eval.items import build_items

train_ids = {row["id"] for row in read_jsonl(Path(sys.argv[2]))}  # the SFT train split
records: dict[str, DialogueRecord] = {}
for row in read_jsonl(Path("work/datagen/local-v1/judged.jsonl")):
    records[row["id"]] = DialogueRecord.model_validate(row)
for record in load_handwritten(sorted(Path("data/handwritten").glob("*.jsonl"))):
    records[record.id] = record
chosen = [records[i] for i in sorted(train_ids) if i in records]
missing = sorted(train_ids - records.keys())
# build_items only takes eval-split records (so the benchmark never holds training scenarios);
# these items are for training, so relabel the copies instead of changing the builder
items = build_items(r.model_copy(update={"split": "eval"}) for r in chosen)
with open(sys.argv[1], "w", encoding="utf-8") as out:
    for item in items:
        out.write(item.model_dump_json(by_alias=True) + "\n")
moves: dict[str, int] = {}
for it in items:
    moves[it.gold.expected_move] = moves.get(it.gold.expected_move, 0) + 1
print(f"{len(chosen)} train dialogues ({len(missing)} ids not found), {len(items)} items, moves {moves}")
