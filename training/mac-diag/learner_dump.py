"""Read-only: join learner-v2 items with one system's predictions.
Row: {id, level, changed, learnerText, nativeText, pred} where pred is
{move, annotations:[{span, corrected, tag}], reply} or {raw: text} if parsing failed.
usage (from training/): learner_dump.py items.jsonl predictions.jsonl system out.jsonl"""

import json
import sys
from pathlib import Path

from datagen.filters import parse_tutor_output
from datagen.jsonutil import read_jsonl
from eval.learner import LearnerItem

items_path, preds_path, system, out_path = sys.argv[1:5]
preds = {r["itemId"]: r["text"] for r in read_jsonl(Path(preds_path)) if r["system"] == system}
n = 0
with open(out_path, "w", encoding="utf-8") as out:
    for raw in read_jsonl(Path(items_path)):
        item = LearnerItem.model_validate(raw)
        text = preds.get(item.id)
        if text is None:
            pred = None
        else:
            parsed, _ = parse_tutor_output(text)
            if parsed is None:
                pred = {"raw": text}
            else:
                ann = parsed.annotations
                notes = []
                if ann.prompt is not None:
                    notes.append({"span": ann.prompt.learner_text, "corrected": None,
                                  "tag": ann.prompt.error_tags})
                if ann.recast is not None:
                    notes.append({"span": ann.recast.learner_text,
                                  "corrected": ann.recast.corrected_text, "tag": ann.recast.error_tags})
                pred = {"move": ann.move, "annotations": notes, "reply": parsed.reply}
        out.write(json.dumps({"id": item.id, "level": item.level.value, "changed": item.changed,
                              "learnerText": item.learner_text, "nativeText": item.native_text,
                              "pred": pred}, ensure_ascii=False) + "\n")
        n += 1
print(f"{n} rows -> {out_path} ({len(preds)} predictions for {system})")
