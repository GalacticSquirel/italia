"""QAT-DPO pairs from mx2 samples (on-policy) and the float round12m teacher (greedy).
over: correct turn, rejected = an mx2 sample that prompts/recasts; chosen = an mx2 sample that
      leaves it alone (on-policy) or else the teacher's none (off-policy; skipped if the teacher flags).
err:  error turn where the teacher makes the gold move; rejected = an mx2 miss (none) or, for gold
      recasts where the teacher's correctedText equals the gold one, an mx2 recast with a different
      correctedText; chosen = an mx2 sample with the gold move (and, for recasts, the teacher's
      correctedText) or else the teacher output.
Matched 1:1 per level, at most MAX per side; teacher-chosen (off-policy) pairs capped at 30%.
usage: qdpo_pairs.py items samples teacher out"""
import json, random, re, sys
from collections import Counter, defaultdict
from datagen.filters import parse_tutor_output

CAP, MAX = 0.30, 600
rng = random.Random(20261123)
items = {json.loads(l)["id"]: json.loads(l) for l in open(sys.argv[1], encoding="utf-8")}

def parse(t):
    p, _ = parse_tutor_output(t)
    if p is None:
        return None
    a = json.loads(p.to_json())["annotations"]
    return {"move": p.annotations.move, "fix": norm((a.get("recast") or {}).get("correctedText") or "")}

def norm(s):
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s']", " ", s.lower())).strip()

samples = defaultdict(list)
for l in open(sys.argv[2], encoding="utf-8"):
    r = json.loads(l)
    p = parse(r["text"])
    if p and r["text"] not in [t for t, _ in samples[r["itemId"]]]:
        samples[r["itemId"]].append((r["text"], p))
teacher = {}
for l in open(sys.argv[3], encoding="utf-8"):
    r = json.loads(l)
    p = parse(r["text"])
    if p:
        teacher[r["itemId"]] = (r["text"], p)
gold_fix = {}
for i, it in items.items():
    g = json.loads(it["reference"])["annotations"].get("recast") or {}
    gold_fix[i] = norm(g.get("correctedText") or "")

over, err = defaultdict(list), defaultdict(list)
skip = Counter()
for i, it in items.items():
    g, ss, lv = it["gold"]["expectedMove"], samples.get(i, []), it["level"]
    pair = lambda kind, ch, rj, src: {"id": i, "kind": kind, "level": lv, "chosenFrom": src,  # noqa: E731
                                      "prompt": it["messages"], "chosen": [{"role": "assistant", "content": ch}],
                                      "rejected": [{"role": "assistant", "content": rj}]}
    if g == "none":
        flags = [t for t, p in ss if p["move"] != "none"]
        if not flags:
            continue
        keep = [t for t, p in ss if p["move"] == "none"]
        if keep:
            over[lv].append(pair("over", rng.choice(keep), rng.choice(flags), "sample"))
        elif i in teacher and teacher[i][1]["move"] == "none":
            over[lv].append(pair("over", teacher[i][0], rng.choice(flags), "teacher"))
        else:
            skip["over: no none available"] += 1
        continue
    if i not in teacher or teacher[i][1]["move"] != g:
        skip["err: teacher not on the gold move"] += 1 if any(p["move"] == "none" for _, p in ss) else 0
        continue
    tfix = teacher[i][1]["fix"]
    misses = [t for t, p in ss if p["move"] == "none"]
    misrec = [t for t, p in ss if g == "recast" and p["move"] == "recast" and tfix and tfix == gold_fix[i]
              and p["fix"] != tfix and p["fix"] != gold_fix[i]]
    rej = misses or misrec
    if not rej:
        continue
    good = [t for t, p in ss if p["move"] == g and (g != "recast" or p["fix"] == tfix)]
    src = "sample" if good else "teacher"
    p_ = pair("err-miss" if misses else "err-misrecast", rng.choice(good) if good else teacher[i][0], rng.choice(rej), src)
    err[lv].append(p_)

# 1:1 per level, on-policy first, at most MAX per side overall
for d in (over, err):
    for lv in d:
        rng.shuffle(d[lv]); d[lv].sort(key=lambda p: p["chosenFrom"] != "sample")
n_lv = {lv: min(len(over[lv]), len(err[lv])) for lv in set(over) | set(err)}
while sum(n_lv.values()) > MAX:
    lv = max(n_lv, key=n_lv.get); n_lv[lv] -= 1
O = {lv: over[lv][:n] for lv, n in n_lv.items()}
E = {lv: err[lv][:n] for lv, n in n_lv.items()}

def offp():
    return sum(p["chosenFrom"] == "teacher" for d in (O, E) for v in d.values() for p in v)

def total():
    return sum(len(v) for d in (O, E) for v in d.values())

# trim off-policy: drop a teacher-chosen pair and its level partner on the other side (both from the end)
while total() and offp() > CAP * total():
    lv = max(n_lv, key=lambda l: sum(p["chosenFrom"] == "teacher" for p in O[l] + E[l]) if n_lv[l] else -1)
    O[lv].pop(); E[lv].pop(); n_lv[lv] -= 1
pairs = [p for d in (O, E) for v in d.values() for p in v]
rng.shuffle(pairs)
with open(sys.argv[4], "w", encoding="utf-8") as f:
    for p in pairs:
        f.write(json.dumps(p, ensure_ascii=False) + "\n")
print(f"candidates: over {sum(map(len, over.values()))}, err {sum(map(len, err.values()))}; skipped {dict(skip)}")
print(f"pairs {len(pairs)}: per side {sum(n_lv.values())}; off-policy (teacher-chosen) {offp()} = {offp()/max(1,len(pairs)):.1%}")
for lv in sorted(n_lv):
    c = Counter(p["kind"] + ("/T" if p["chosenFrom"] == "teacher" else "") for p in O[lv] + E[lv])
    print(f"  {lv}: {n_lv[lv]} per side; {dict(c)}")
