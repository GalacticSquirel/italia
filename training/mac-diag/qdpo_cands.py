"""Turns worth a teacher pass: correct turns where some mx2 sample flags; error turns where some
sample misses (none) or recasts (possible mis-recast). usage: qdpo_cands.py items samples out"""
import json, sys
from collections import Counter
from datagen.filters import parse_tutor_output

items = {json.loads(l)["id"]: json.loads(l) for l in open(sys.argv[1], encoding="utf-8")}
moves = {}
for l in open(sys.argv[2], encoding="utf-8"):
    r = json.loads(l)
    p, _ = parse_tutor_output(r["text"])
    moves.setdefault(r["itemId"], []).append("invalid" if p is None else p.annotations.move)
c, out = Counter(), []
for i, it in items.items():
    g, ms = it["gold"]["expectedMove"], moves.get(i, [])
    c[f"{'none' if g == 'none' else 'error'} sampled"] += bool(ms)
    if g == "none" and any(m in ("prompt", "recast") for m in ms):
        out.append(it); c["correct turns with a flag"] += 1
    elif g != "none" and ("none" in ms or (g == "recast" and "recast" in ms)):
        out.append(it); c["error turns with a miss or a recast"] += 1
        c["  of which a miss"] += "none" in ms
with open(sys.argv[3], "w", encoding="utf-8") as f:
    for it in out:
        f.write(json.dumps(it, ensure_ascii=False) + "\n")
print(dict(c))
