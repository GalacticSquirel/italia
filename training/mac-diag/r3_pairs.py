"""Round 3, step 2: on-policy DPO pairs. Where round 2's turn disagrees with gold on its own
training data, chosen = the gold (reference) turn, rejected = round 2's turn. Pairs in the weak
areas of the round-2 benchmark are written twice.
usage (from training/): r3_pairs.py items.jsonl predictions.jsonl system pairs.jsonl"""

import json
import sys
from collections import Counter
from pathlib import Path

from datagen.filters import parse_tutor_output
from datagen.jsonutil import read_jsonl
from datagen.languagetool import LanguageToolClient
from eval.items import EvalItem
from eval.metrics import _leaks, _recast_correct

WEAK_TAGS = {"ci-ne", "preposition", "future-form", "false-friend"}
WEAK_LEVELS = {"B1"}
WEIGHT = 2

items = {i.id: i for i in (EvalItem.model_validate(r) for r in read_jsonl(Path(sys.argv[1])))}
system = sys.argv[3]
preds = {r["itemId"]: r["text"] for r in read_jsonl(Path(sys.argv[2])) if r["system"] == system}
grammar = LanguageToolClient("http://localhost:8010/v2")


def reasons(item: EvalItem, text: str) -> list[str]:
    pred, _ = parse_tutor_output(text)
    if pred is None:
        return ["invalid"]
    gold, move = item.gold.expected_move, pred.annotations.move
    out = []
    if gold == "none" and move != "none":
        out.append("over-correction")
    if gold != "none" and move == "none":
        out.append("missed-correction")
    if gold != "none" and move != "none":
        if move != gold:
            out.append("wrong-move")
        if item.gold.target_tag not in pred.annotations.error_tags:
            out.append("wrong-error")
    if gold == "recast" and move == "recast" and not _recast_correct(pred, item, grammar):
        out.append("wrong-recast")
    if _leaks(pred, item):
        out.append("prompt-leaks")
    return out


mix: Counter[str] = Counter()
weak_mix: Counter[str] = Counter()
by_level: Counter[str] = Counter()
by_tag: Counter[str] = Counter()
pairs = written = skipped = inconsistent = 0
with open(sys.argv[4], "w", encoding="utf-8") as out:
    for item_id, item in items.items():
        text = preds.get(item_id)
        if text is None:
            skipped += 1
            continue
        why = reasons(item, text)
        reference, _ = parse_tutor_output(item.reference)
        if not why or reference is None or text.strip() == item.reference.strip():
            continue
        # the gold turn must itself follow the plan: some round-1 teacher turns recast where the
        # plan says no correction is due, and as "chosen" they would teach the opposite
        if reference.annotations.move != item.gold.expected_move:
            inconsistent += 1
            continue
        tag = item.gold.target_tag or "-"
        weak = (
            tag in WEAK_TAGS
            or item.level.value in WEAK_LEVELS
            or "wrong-recast" in why
        )
        copies = WEIGHT if weak else 1
        row = {
            "prompt": item.messages,
            "chosen": [{"role": "assistant", "content": item.reference}],
            "rejected": [{"role": "assistant", "content": text}],
            "reasons": why,
        }
        for c in range(copies):
            out.write(json.dumps({"id": f"{item_id}:{c}", **row}, ensure_ascii=False) + "\n")
            written += 1
        pairs += 1
        mix.update(why)
        if weak:
            weak_mix.update([f"tag:{tag}" if tag in WEAK_TAGS else "", f"level:{item.level.value}" if item.level.value in WEAK_LEVELS else "", "wrong-recast" if "wrong-recast" in why else ""])
        by_level[item.level.value] += 1
        by_tag[tag] += 1
weak_mix.pop("", None)
print(f"items {len(items)}, predictions missing {skipped}, "
      f"skipped where the gold turn breaks its own plan {inconsistent}")
print(f"pairs {pairs} (rows written {written}; weak-area pairs written x{WEIGHT})")
print("reasons:", dict(mix.most_common()))
print("weak-area hits:", dict(weak_mix.most_common()))
print("pairs by level:", dict(sorted(by_level.items())))
print("pairs by target tag (top 15):", dict(by_tag.most_common(15)))
