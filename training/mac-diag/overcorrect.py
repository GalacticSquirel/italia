"""Read-only: bench over-correction items (gold move none, predicted prompt/recast) per system.
Prints the denominator and a tag-count summary for each system, then JSON lines for the first system.
usage (from training/): overcorrect.py round6-sft round5-sft"""

import json
import sys
from collections import Counter
from pathlib import Path

from datagen.filters import parse_tutor_output
from datagen.jsonutil import read_jsonl
from eval.items import EvalItem

items = [EvalItem.model_validate(r) for r in read_jsonl(Path("work/eval/bench.jsonl"))]
none_items = [i for i in items if i.gold.expected_move == "none"]
rows: dict[str, list[dict]] = {}
for system in sys.argv[1:]:
    preds = {r["itemId"]: r["text"] for r in read_jsonl(Path("work/eval/bench-predictions.jsonl"))
             if r["system"] == system}
    out = []
    for item in none_items:
        pred, _ = parse_tutor_output(preds.get(item.id, ""))
        if pred is None or pred.annotations.move not in ("prompt", "recast"):
            continue
        ann = pred.annotations
        a = ann.prompt if ann.move == "prompt" else ann.recast
        row = {"id": item.id, "level": item.level.value, "learnerText": item.learner_text,
               "move": ann.move, "tags": a.error_tags, "span": a.learner_text}
        if ann.move == "recast":
            row["corrected"] = a.corrected_text
        out.append(row)
    rows[system] = out
    tags = Counter(t for r in out for t in r["tags"])
    moves = Counter(r["move"] for r in out)
    levels = Counter(r["level"] for r in out)
    print(f"{system}: {len(out)}/{len(none_items)} over-corrections ({len(out)/len(none_items):.1%}); "
          f"moves {dict(moves)}; levels {dict(sorted(levels.items()))}")
    print(f"  tags: {dict(tags.most_common())}")
first = sys.argv[1]
with open(f"/Users/owen/italia-diag/{first}-overcorrect.jsonl", "w", encoding="utf-8") as f:
    for r in rows[first]:
        f.write(json.dumps(r, ensure_ascii=False) + "\n")
