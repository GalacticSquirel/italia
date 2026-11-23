"""Read-only export of round4-sft's failures as JSONL, one row per item:
{group, itemId, level, learnerText, gold:{move, tag, learnerSpan, correctedSpan},
 pred:{move, annotations:[{span, corrected, tag}], reply}}
Groups: overcorrect, recast_fail (PR #48 check), miss (C2 under-correction or wrong move, and
under-corrections tagged false-friend / ci-ne / word-choice / preposition), learner_falseflag,
learner_miss. usage (from training/): r4_export.py system out.jsonl"""

import json
import os
import sys
from pathlib import Path

from datagen.filters import parse_tutor_output
from datagen.jsonutil import read_jsonl
from datagen.languagetool import LanguageToolClient
from eval.items import EvalItem
from eval.learner import LearnerItem
from eval.metrics import _recast_correct

SYSTEM = sys.argv[1]
MISS_TAGS = {"false-friend", "ci-ne", "word-choice", "preposition"}
grammar = LanguageToolClient("http://localhost:8010/v2")


def preds(path: str) -> dict[str, str]:
    return {r["itemId"]: r["text"] for r in read_jsonl(Path(path)) if r["system"] == SYSTEM}


def pred_block(text: str) -> tuple[str, dict]:
    pred, _ = parse_tutor_output(text)
    if pred is None:
        return "invalid", {"move": "invalid", "annotations": [], "reply": text[:300]}
    ann = pred.annotations
    out = []
    if ann.prompt is not None:
        out.append({"span": ann.prompt.learner_text, "corrected": None, "tag": ann.prompt.error_tags})
    if ann.recast is not None:
        out.append({"span": ann.recast.learner_text, "corrected": ann.recast.corrected_text,
                    "tag": ann.recast.error_tags})
    return ann.move, {"move": ann.move, "annotations": out, "reply": pred.reply[:300]}


rows = []
bench = preds("work/eval/bench-predictions.jsonl")
for raw in read_jsonl(Path("work/eval/bench.jsonl")):
    item = EvalItem.model_validate(raw)
    text = bench.get(item.id, "")
    move, block = pred_block(text)
    g = item.gold
    groups = []
    if g.expected_move == "none" and move in ("prompt", "recast"):
        groups.append("overcorrect")
    if g.expected_move == "recast" and move == "recast":
        pred, _ = parse_tutor_output(text)
        if pred is not None and not _recast_correct(pred, item, grammar):
            groups.append("recast_fail")
    missed = g.expected_move != "none" and move == "none"
    wrong_move = g.expected_move != "none" and move not in ("none", "invalid", g.expected_move)
    if (item.level.value == "C2" and (missed or wrong_move)) or (missed and g.target_tag in MISS_TAGS):
        groups.append("miss")
    for group in groups:
        rows.append({
            "group": group, "itemId": item.id, "level": item.level.value,
            "learnerText": item.learner_text,
            "gold": {"move": g.expected_move, "tag": g.target_tag,
                     "learnerSpan": g.learner_span, "correctedSpan": g.corrected_span},
            "pred": block,
        })

learner_path = Path(os.environ.get("LEARNER_PREDS", "work/eval/learner-predictions.jsonl"))
if learner_path.exists():
    lpreds = preds(str(learner_path))
    for raw in read_jsonl(Path(os.environ.get("LEARNER_ITEMS", "work/eval/learner.jsonl"))):
        item = LearnerItem.model_validate(raw)
        if item.id not in lpreds:
            continue
        move, block = pred_block(lpreds[item.id])
        if not item.changed and move in ("prompt", "recast"):
            group = "learner_falseflag"
        elif item.changed and move == "none":
            group = "learner_miss"
        else:
            continue
        rows.append({
            "group": group, "itemId": item.id, "level": item.level.value,
            "learnerText": item.learner_text,
            "gold": {"move": "correction" if item.changed else "none", "tag": None,
                     "learnerSpan": item.learner_text, "correctedSpan": item.native_text},
            "pred": block,
        })

with open(sys.argv[2], "w", encoding="utf-8") as out:
    for row in rows:
        out.write(json.dumps(row, ensure_ascii=False) + "\n")
counts: dict[str, int] = {}
for row in rows:
    counts[row["group"]] = counts.get(row["group"], 0) + 1
print(f"{len(rows)} rows -> {sys.argv[2]}: {counts}")
