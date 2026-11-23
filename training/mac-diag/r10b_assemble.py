"""Round 10b: assemble pairs = judge-ranked on-policy pairs + 300 (b) missed-correction pairs from
round 9 (chosen = gold), stratified by level + r-reply gold-vs-sample pairs capped at 25% of all.
usage: r10b_assemble.py ranked.jsonl r9pairs.jsonl reply.jsonl out.jsonl"""

import json
import random
import sys
from collections import Counter

rng = random.Random(20261124)
load = lambda p: [json.loads(l) for l in open(p, encoding="utf-8")]  # noqa: E731
ranked, r9, reply = load(sys.argv[1]), load(sys.argv[2]), load(sys.argv[3])
b_pool = [p for p in r9 if p["kind"] == "b"]
levels = sorted({p["level"] for p in b_pool})
b = []
for lv in levels:  # 300 stratified: equal per level where possible
    cell = [p for p in b_pool if p["level"] == lv]
    b += rng.sample(cell, min(len(cell), 300 // len(levels)))
rest = [p for p in b_pool if p not in b]
b += rng.sample(rest, 300 - len(b)) if len(b) < 300 else []
for p in b:
    p["kind"] = "missed"
base = ranked + b
cap = len(base) // 3  # reply <= 25% of the total  <=>  reply <= base / 3
reply_kept = rng.sample(reply, min(len(reply), cap))
pairs = base + reply_kept
rng.shuffle(pairs)
with open(sys.argv[4], "w", encoding="utf-8") as out:
    for p in pairs:
        out.write(json.dumps(p, ensure_ascii=False) + "\n")
print(f"pairs {len(pairs)}: ranked {len(ranked)}, missed {len(b)}, reply {len(reply_kept)} "
      f"(of {len(reply)}, cap {cap})")
for lv in sorted({p["level"] for p in pairs}):
    c = Counter(p["kind"] for p in pairs if p["level"] == lv)
    print(f"  {lv}: " + ", ".join(f"{k} {c[k]}" for k in ("judged", "gold", "missed", "reply")))
