"""False flags of SYS on bench control items (gold move none) that REF leaves alone (REF predicts none).
usage: overcorr.py items.jsonl predictions.jsonl SYS REF"""
import json, sys
from collections import Counter, defaultdict
from datagen.filters import parse_tutor_output

items = {json.loads(l)["id"]: json.loads(l) for l in open(sys.argv[1])}
sysname, ref = sys.argv[3], sys.argv[4]
preds = defaultdict(dict)
for l in open(sys.argv[2]):
    p = json.loads(l)
    if p["system"] in (sysname, ref):
        preds[p["system"]][p["itemId"]] = p["text"]

def parse(text):
    p, _ = parse_tutor_output(text)
    if p is None:
        return "invalid", {}
    ann = json.loads(p.to_json())["annotations"]
    fb = ann.get("prompt") or ann.get("recast") or {}
    return p.annotations.move, fb

ctrl = [i for i, it in items.items() if (it.get("gold") or {}).get("expectedMove", "none") == "none"]
rows, ref_flags, sys_flags = [], 0, 0
for i in ctrl:
    m_ref, _ = parse(preds[ref].get(i, ""))
    m_sys, fb = parse(preds[sysname].get(i, ""))
    ref_flags += m_ref not in ("none", "invalid")
    sys_flags += m_sys not in ("none", "invalid")
    if m_ref == "none" and m_sys not in ("none", "invalid"):
        it = items[i]
        learner = next(m["content"] for m in reversed(it["messages"]) if m["role"] == "user")
        rows.append((it["level"], m_sys, fb.get("errorTags") or ["?"], learner, fb))

by_level = Counter(r[0] for r in rows)
by_tag = Counter(t for r in rows for t in r[2])
by_move = Counter(r[1] for r in rows)
lt = defaultdict(Counter)
for r in rows:
    for t in r[2]:
        lt[r[0]][t] += 1
print(f"Control items: {len(ctrl)}. Flagged by {sysname}: {sys_flags}; by {ref}: {ref_flags}.")
print(f"Flagged by {sysname} but left alone by {ref}: {len(rows)}  (moves: {dict(by_move)})\n")
print("By level:", ", ".join(f"{k} {v}" for k, v in sorted(by_level.items())))
print("\nBy error tag:")
for t, n in by_tag.most_common():
    print(f"  {t:28s} {n}")
print("\nBy level x tag:")
for lvl in sorted(lt):
    print(f"  {lvl}: " + ", ".join(f"{t} {n}" for t, n in lt[lvl].most_common()))
print("\nItems:")
for lvl, mv, tags, learner, fb in sorted(rows, key=lambda r: (r[0], r[2])):
    rest = {k: v for k, v in fb.items() if k != "errorTags"}
    print(f"[{lvl}] {mv} {tags}\n   learner: {learner}\n   flag: {json.dumps(rest, ensure_ascii=False)}")
