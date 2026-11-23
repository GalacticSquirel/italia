"""Read-only: why round3-sft's recasts fail _recast_correct on the bench. Re-applies each check of
eval.metrics._recast_correct separately (scorer unchanged) and prints one JSON line per failure.
usage (from training/): recast_fails.py items.jsonl predictions.jsonl system"""

import json
import sys
from pathlib import Path

from datagen.filters import parse_tutor_output
from datagen.jsonutil import read_jsonl
from datagen.languagetool import LanguageToolClient
from eval.items import EvalItem
from eval.metrics import _norm, _recast_correct

items = [EvalItem.model_validate(r) for r in read_jsonl(Path(sys.argv[1]))]
preds = {r["itemId"]: r["text"] for r in read_jsonl(Path(sys.argv[2])) if r["system"] == sys.argv[3]}
grammar = LanguageToolClient("http://localhost:8010/v2")
total = recast_both = 0
for item in items:
    if item.gold.expected_move != "recast":
        continue
    total += 1
    pred, _ = parse_tutor_output(preds.get(item.id, ""))
    if pred is None or pred.annotations.recast is None:
        continue
    recast_both += 1
    if _recast_correct(pred, item, grammar):
        continue
    r = pred.annotations.recast
    gold_fix = item.gold.corrected_span
    if not gold_fix:
        ref, _ = parse_tutor_output(item.reference)
        gold_fix = ref.annotations.recast.corrected_text if ref and ref.annotations.recast else None
    span_ok = bool(gold_fix) and (
        _norm(gold_fix) in _norm(r.corrected_text)
        if item.gold.corrected_span
        else _norm(gold_fix) == _norm(r.corrected_text)
    )
    lt = [m.span(r.corrected_text) + f" ({m.rule_id})" for m in grammar.check(r.corrected_text)]
    print(json.dumps({
        "id": item.id, "level": item.level.value, "target_tag": item.gold.target_tag,
        "model_tags": r.error_tags, "learner_span": item.gold.learner_span,
        "gold_fix": gold_fix, "gold_fix_is_span": bool(item.gold.corrected_span),
        "model_learner_text": r.learner_text, "model_corrected_text": r.corrected_text,
        "reply": pred.reply, "tag_miss": item.gold.target_tag not in r.error_tags,
        "span_miss": not span_ok, "lt": lt,
    }, ensure_ascii=False))
print(json.dumps({"summary": {"gold_recast": total, "model_recast_too": recast_both}}))
