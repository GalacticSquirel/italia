"""Round 12: pairs = on-policy judge-ranked reply pairs (R) + on-policy over-correction pairs (O,
target 1.5 x E) + r-miss gold-vs-sample pairs (E error turns + up to E none turns).
Off-policy = r-miss pairs + over pairs whose chosen is the gold turn; capped at 25% of the total,
trimming r-miss none turns first, then r-miss error turns.
usage: r12_assemble.py ranked.jsonl over-candidates.jsonl rmiss.jsonl out.jsonl"""

import json
import random
import sys
from collections import Counter

rng = random.Random(20261130)
load = lambda p: [json.loads(l) for l in open(p, encoding="utf-8")]  # noqa: E731
ranked, over_c, rmiss = load(sys.argv[1]), load(sys.argv[2]), load(sys.argv[3])
for p in rmiss:
    p["kind"] = "rmiss-" + ("none" if p["move"] == "none" else "error")
err = [p for p in rmiss if p["kind"] == "rmiss-error"]
non = [p for p in rmiss if p["kind"] == "rmiss-none"]
E = len(err)
non = rng.sample(non, min(len(non), E))
# over: prefer focus-tag rejects, then C1/C2, then on-policy chosen
over_c.sort(key=lambda p: (not p["focus"], p["level"] not in ("C1", "C2"), p["chosenFrom"] != "sample", rng.random()))
over = list(over_c)  # all candidates (coordinator, 15:12): over-correction is the target failure


def offp() -> int:
    return len(err) + len(non) + sum(1 for p in over if p["chosenFrom"] == "gold")


def total() -> int:
    return len(ranked) + len(over) + len(err) + len(non)


while offp() > 0.25 * total() and non:
    non.pop()
while offp() > 0.25 * total() and err:
    err.pop()
pairs = ranked + over + err + non
rng.shuffle(pairs)
with open(sys.argv[4], "w", encoding="utf-8") as out:
    for p in pairs:
        out.write(json.dumps(p, ensure_ascii=False) + "\n")
print(f"E (r-miss error-turn pairs available) = {E}")
print(f"pairs {len(pairs)}: ranked {len(ranked)}, over {len(over)} (of {len(over_c)} candidates; "
      f"focus-tag {sum(p['focus'] for p in over)}, gold-chosen {sum(p['chosenFrom'] == 'gold' for p in over)}), "
      f"r-miss error {len(err)}, r-miss none {len(non)}; off-policy {offp()} = {offp() / len(pairs):.1%}")
for lv in sorted({p["level"] for p in pairs}):
    c = Counter(p["kind"] for p in pairs if p["level"] == lv)
    print(f"  {lv}: " + ", ".join(f"{k} {c[k]}" for k in ("judged", "over", "rmiss-error", "rmiss-none")))
