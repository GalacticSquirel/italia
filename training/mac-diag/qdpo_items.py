"""QAT-DPO mining pool: train-split turns (bench- and learner-v2-disjoint) whose reference move
equals the gold move; ~4,000 correct (gold none) and ~2,400 error turns, spread across levels."""
import collections, json, random

rng = random.Random(20261123)
eval_ids = set()
for f in ("work/eval/bench.jsonl", "work/eval/learner-v2.jsonl"):
    for l in open(f):
        r = json.loads(l); eval_ids.add(r["id"]); eval_ids.add(r.get("dialogueId", ""))
cells = collections.defaultdict(list)
for l in open("work/dpo-round9/train-items.jsonl"):
    r = json.loads(l)
    if r["id"] in eval_ids or r.get("dialogueId") in eval_ids:
        continue
    ref = json.loads(r["reference"])["annotations"]
    m = "prompt" if ref.get("prompt") else "recast" if ref.get("recast") else "none"
    if m != r["gold"]["expectedMove"]:
        continue
    cells[(r["level"], "none" if m == "none" else "error")].append(l)
levels = sorted({k[0] for k in cells})
out = []
for kind, total in (("none", 4000), ("error", 2400)):
    # equal share per level, unused share redistributed to levels with more turns
    want, left = {}, total
    pool = {lv: len(cells[(lv, kind)]) for lv in levels}
    active = [lv for lv in levels if pool[lv]]
    while left and active:
        share = max(1, left // len(active))
        for lv in list(active):
            take = min(share, pool[lv] - want.get(lv, 0), left)
            want[lv] = want.get(lv, 0) + take; left -= take
            if want[lv] >= pool[lv]:
                active.remove(lv)
            if not left:
                break
    for lv, n in want.items():
        out += rng.sample(cells[(lv, kind)], n)
    print(kind, dict(sorted(want.items())))
rng.shuffle(out)
open("work/qdpo/items.jsonl", "w").writelines(out)
print("mining items", len(out))
