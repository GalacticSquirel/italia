"""Round 13: ranked on-policy reply pairs + up to 120 on-policy over-correction pairs (stratified by
level) + new-set gold-vs-sample pairs (error and correct turns in equal numbers) + echo/affirm
negatives. Off-policy (new-set pairs, echo pairs, gold-chosen over pairs) capped at 30%; trimmed
in order: new-set none turns, echo pairs, new-set error turns.
usage: r13_assemble.py ranked.jsonl over-candidates.jsonl newsets.jsonl echo.jsonl out.jsonl"""

import json
import random
import sys
from collections import Counter

CAP = 0.30
OVER_N = 120
rng = random.Random(20261202)
load = lambda p: [json.loads(l) for l in open(p, encoding="utf-8")]  # noqa: E731
ranked, over_c, newsets, echo = (load(p) for p in sys.argv[1:5])
# over: ~120 stratified by level, focus tags first within level
by_lv: dict[str, list] = {}
for p in over_c:
    by_lv.setdefault(p["level"], []).append(p)
for lv in by_lv:
    by_lv[lv].sort(key=lambda p: (not p["focus"], p["chosenFrom"] != "sample", rng.random()))
over, i = [], 0
while len(over) < min(OVER_N, len(over_c)):
    for lv in sorted(by_lv):
        if i < len(by_lv[lv]) and len(over) < OVER_N:
            over.append(by_lv[lv][i])
    i += 1
for p in newsets:
    p["kind"] = "new-" + ("none" if p["move"] == "none" else "error")
err = [p for p in newsets if p["kind"] == "new-error"]
non = rng.sample([p for p in newsets if p["kind"] == "new-none"],
                 min(len(err), sum(1 for p in newsets if p["kind"] == "new-none")))
err = rng.sample(err, min(len(err), len(non))) if len(non) < len(err) else err
echo = list(echo)


def offp():
    return len(err) + len(non) + len(echo) + sum(p["chosenFrom"] == "gold" for p in over)


def total():
    return len(ranked) + len(over) + len(err) + len(non) + len(echo)


# keep new-set error and correct turns equal: trim them in pairs, then echo if still over the cap
while offp() > CAP * total() and (err or non):
    if len(err) >= len(non) and err:
        err.pop()
    elif non:
        non.pop()
while offp() > CAP * total() and echo:
    echo.pop()
n = min(len(err), len(non))
err, non = err[:n], non[:n]
pairs = ranked + over + err + non + echo
rng.shuffle(pairs)
with open(sys.argv[5], "w", encoding="utf-8") as out:
    for p in pairs:
        out.write(json.dumps(p, ensure_ascii=False) + "\n")
print(f"pairs {len(pairs)}: ranked {len(ranked)}, over {len(over)} (of {len(over_c)}), new-set error {len(err)}, "
      f"new-set none {len(non)}, echo {len(echo)}; off-policy {offp()} = {offp() / len(pairs):.1%}")
for lv in sorted({p["level"] for p in pairs}):
    c = Counter(p["kind"] for p in pairs if p["level"] == lv)
    print(f"  {lv}: " + ", ".join(f"{k} {c[k]}" for k in ("judged", "over", "new-error", "new-none", "echo")))
