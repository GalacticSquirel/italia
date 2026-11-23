"""Read-only: output-guard measurement on round8-sft predictions (bench + learner-v2).
Rule 1: a prompt/recast span not in the learner text (case- and whitespace-insensitive) -> move none.
Rule 2: a recast whose corrected text equals its span ignoring case and punctuation -> move none.
Writes variant predictions (systems round8-sft+g1, +g2, +g12) to OUT_DIR for the official scorers,
and prints how often each rule fires, plus rule 3 (prompts whose reply contains the gold correction).
usage (from training/): guard.py OUT_DIR"""

import json
import re
import sys
from pathlib import Path

from datagen.jsonutil import read_jsonl

SYSTEM = "round8-sft"
out_dir = Path(sys.argv[1])
out_dir.mkdir(parents=True, exist_ok=True)


def ws(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip().lower()


def bare(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", s)).strip().lower()


def guard(text: str, learner: str, rules: set[int]) -> tuple[str, set[int]]:
    """The prediction with the rules applied, and which rules fired."""
    try:
        d = json.loads(text)
        ann = d["annotations"]
    except Exception:
        return text, set()
    fired = set()
    for key in ("prompt", "recast"):
        fb = ann.get(key)
        if not fb:
            continue
        span = fb.get("learnerText") or ""
        if ws(span) not in ws(learner):
            fired.add(1)
        if key == "recast" and bare(fb.get("correctedText") or "") == bare(span):
            fired.add(2)
    if fired & rules:
        ann["prompt"] = None
        ann["recast"] = None
        return json.dumps(d, ensure_ascii=False, separators=(",", ":")), fired
    return text, fired


VARIANTS = {"g1": {1}, "g2": {2}, "g12": {1, 2}}
for name, items_path, preds_path in (
    ("bench", "work/eval/bench.jsonl", "work/eval/bench-predictions.jsonl"),
    ("learner-v2", "work/eval/learner-v2.jsonl", "work/eval/learner-v2-predictions.jsonl"),
):
    items = {r["id"]: r for r in read_jsonl(Path(items_path))}
    preds = [r for r in read_jsonl(Path(preds_path)) if r["system"] == SYSTEM]
    counts = {1: 0, 2: 0, "both": 0}
    with open(out_dir / f"{name}-predictions.jsonl", "w", encoding="utf-8") as out:
        for r in preds:
            out.write(json.dumps(r, ensure_ascii=False) + "\n")
            learner = items[r["itemId"]]["messages"][-1]["content"]
            _, fired = guard(r["text"], learner, {1, 2})
            for k in fired:
                counts[k] += 1
            counts["both"] += bool(fired)
            for vname, rules in VARIANTS.items():
                text, _ = guard(r["text"], learner, rules)
                out.write(json.dumps({**r, "system": f"{SYSTEM}+{vname}", "text": text},
                                     ensure_ascii=False) + "\n")
    print(f"{name}: {len(preds)} predictions; rule 1 fires {counts[1]}, rule 2 fires {counts[2]}, "
          f"either {counts['both']}")
    if name == "bench":
        leaks = scored = 0
        for r in preds:
            gold = items[r["itemId"]]["gold"]
            try:
                d = json.loads(r["text"])
            except Exception:
                continue
            if d["annotations"].get("prompt") and gold.get("correctedSpan"):
                scored += 1
                leaks += bare(gold["correctedSpan"]) in bare(d["reply"])
        print(f"bench rule 3: {leaks} of {scored} prompts (on items with a gold correction) contain "
              f"the gold corrected form in the reply")
