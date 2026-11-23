"""Round 9c (1:2 variant of r9_pairs.py), step 2: balanced on-policy DPO pairs from 4 temperature-0.8 samples of round8-sft per turn.
Chosen = the gold (reference) turn. Kinds:
  a over-correction: gold none, sample prompts or recasts
  b missed: gold corrects, sample gives none or a span not overlapping the gold span
  c bad recast: gold recast, sample recast whose fix differs from gold (case/punctuation-insensitive);
    or any prompt sample that gives the gold correction away
At most one pair per turn; (a) downsampled to (b)+(c); total capped at CAP.
usage (from training/): r9_pairs.py subset.jsonl samples.jsonl pairs.jsonl"""

import json
import random
import re
import sys
from collections import Counter
from pathlib import Path

from datagen.filters import parse_tutor_output
from datagen.jsonutil import read_jsonl
from eval.items import EvalItem
from eval.metrics import _leaks

CAP = 3000
SYSTEMS = ("r9-s1", "r9-s2", "r9-s3", "r9-s4")
rng = random.Random(20261120)


def bare(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", s or "")).strip().lower()


def words(s: str) -> set[str]:
    return set(bare(s).split())


items = [EvalItem.model_validate(r) for r in read_jsonl(Path(sys.argv[1]))]
samples: dict[str, list[str]] = {}
for r in read_jsonl(Path(sys.argv[2])):
    if r["system"] in SYSTEMS:
        samples.setdefault(r["itemId"], []).append(r["text"])


def kind(item: EvalItem, ref, text: str) -> str | None:
    pred, _ = parse_tutor_output(text)
    if pred is None or text.strip() == item.reference.strip():
        return None
    gold, move = item.gold.expected_move, pred.annotations.move
    if gold == "none":
        return "a" if move != "none" else None
    if move == "prompt" and _leaks(pred, item):
        return "c"
    if move == "none":
        return "b"
    gold_fb = ref.annotations.prompt or ref.annotations.recast
    gold_span = item.gold.learner_span or (gold_fb.learner_text if gold_fb else "")
    fb = pred.annotations.prompt or pred.annotations.recast
    if gold_span and fb and not (words(fb.learner_text) & words(gold_span)):
        return "b"
    if gold == "recast" and move == "recast":
        gold_fix = item.gold.corrected_span or ref.annotations.recast.corrected_text
        if bare(pred.annotations.recast.corrected_text) != bare(gold_fix) and \
                bare(gold_fix) not in bare(pred.annotations.recast.corrected_text):
            return "c"
    return None


by_kind: dict[str, list[dict]] = {"a": [], "b": [], "c": []}
turns_with_samples = 0
for item in items:
    texts = samples.get(item.id, [])
    if not texts:
        continue
    turns_with_samples += 1
    ref, _ = parse_tutor_output(item.reference)
    found = [(k, t) for t in texts if (k := kind(item, ref, t))]
    if not found:
        continue
    k, rejected = rng.choice(found)
    by_kind[k].append({
        "id": item.id, "kind": k, "level": item.level.value,
        "prompt": item.messages,
        "chosen": [{"role": "assistant", "content": item.reference}],
        "rejected": [{"role": "assistant", "content": rejected}],
    })

raw = {k: len(v) for k, v in by_kind.items()}
fix = by_kind["b"] + by_kind["c"]
# round 9c: a : (b+c) = 1 : 2, the (a) pairs drawn per level in proportion to the (a) pool
target = len(fix) // 2
pool = by_kind["a"]
levels_a = sorted({p["level"] for p in pool})
over = []
for lv in levels_a:
    cell = [p for p in pool if p["level"] == lv]
    over += rng.sample(cell, min(len(cell), round(target * len(cell) / len(pool))))
pairs = fix + over
rng.shuffle(pairs)
with open(sys.argv[3], "w", encoding="utf-8") as out:
    for p in pairs:
        out.write(json.dumps(p, ensure_ascii=False) + "\n")
final = Counter(p["kind"] for p in pairs)
print(f"turns sampled {turns_with_samples}; candidate pairs a {raw['a']}, b {raw['b']}, c {raw['c']}")
print(f"kept {len(pairs)}: a {final['a']}, b {final['b']}, c {final['c']}")
levels = sorted({p["level"] for p in pairs})
for lv in levels:
    c = Counter(p["kind"] for p in pairs if p["level"] == lv)
    print(f"  {lv}: a {c['a']}, b {c['b']}, c {c['c']}, total {sum(c.values())}")
