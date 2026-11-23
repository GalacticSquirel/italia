"""Round 11: pairs = judge-ranked on-policy reply pairs + on-policy missed-correction pairs +
r-clue-answer gold-vs-sample pairs (capped at 25% of all).
usage: r11_assemble.py ranked.jsonl missed.jsonl clue.jsonl out.jsonl"""

import json
import random
import sys
from collections import Counter

rng = random.Random(20261126)
load = lambda p: [json.loads(l) for l in open(p, encoding="utf-8")]  # noqa: E731
ranked, missed, clue = load(sys.argv[1]), load(sys.argv[2]), load(sys.argv[3])
for p in clue:
    p["kind"] = "clue"
base = ranked + missed
cap = len(base) // 3
clue_kept = rng.sample(clue, min(len(clue), cap))
pairs = base + clue_kept
rng.shuffle(pairs)
with open(sys.argv[4], "w", encoding="utf-8") as out:
    for p in pairs:
        out.write(json.dumps(p, ensure_ascii=False) + "\n")
print(f"pairs {len(pairs)}: ranked {len(ranked)}, missed {len(missed)}, clue {len(clue_kept)} "
      f"(of {len(clue)}, cap {cap})")
for lv in sorted({p["level"] for p in pairs}):
    c = Counter(p["kind"] for p in pairs if p["level"] == lv)
    print(f"  {lv}: " + ", ".join(f"{k} {c[k]}" for k in ("judged", "missed", "clue")))
