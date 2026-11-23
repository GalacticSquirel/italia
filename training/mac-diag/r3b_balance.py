"""Round 3b: rebalance the round-3 on-policy pairs so "the answer that corrects wins" is no longer
a shortcut. round3-dpo learned it from a 4:1 mix and over-corrected 86% of the bench.

Pairs whose gold (chosen) move is "none" are written 3 times; correction pairs are then sampled
to the same number of rows, weak-area pairs first. Rows keep their reasons.
usage: r3b_balance.py pairs-in.jsonl pairs-out.jsonl"""

import json
import random
import sys
from collections import Counter

from datagen.filters import parse_tutor_output

QUIET_COPIES = 3
WEAK_TAGS = {"ci-ne", "preposition", "future-form", "false-friend"}
random.seed(20261118)

# r3_pairs.py wrote weak-area pairs twice (ids end in :0 and :1); take each pair once
pairs: dict[str, dict] = {}
for line in open(sys.argv[1], encoding="utf-8"):
    row = json.loads(line)
    base = row["id"].rsplit(":", 1)[0]
    pairs.setdefault(base, row)


def chosen_move(row: dict) -> str:
    pred, _ = parse_tutor_output(row["chosen"][0]["content"])
    return "invalid" if pred is None else pred.annotations.move


def is_weak(base: str, row: dict) -> bool:
    if "wrong-recast" in row["reasons"]:
        return True
    system = row["prompt"][0]["content"]
    return any(f'"{t}"' in json.dumps(row["chosen"]) for t in WEAK_TAGS) or "B1" in system


quiet = [(b, r) for b, r in pairs.items() if chosen_move(r) == "none"]
correct = [(b, r) for b, r in pairs.items() if chosen_move(r) in ("prompt", "recast")]
target = QUIET_COPIES * len(quiet)
weak = [p for p in correct if is_weak(*p)]
other = [p for p in correct if not is_weak(*p)]
random.shuffle(weak)
random.shuffle(other)
picked = (weak + other)[:target]

rows = [(b, r, c) for b, r in quiet for c in range(QUIET_COPIES)] + [(b, r, 0) for b, r in picked]
random.shuffle(rows)
with open(sys.argv[2], "w", encoding="utf-8") as out:
    for b, r, c in rows:
        out.write(json.dumps({**r, "id": f"{b}:{c}"}, ensure_ascii=False) + "\n")

print(f"unique pairs {len(pairs)}: chosen none {len(quiet)}, chosen correction {len(correct)} "
      f"(weak {len(weak)}, other {len(other)})")
print(f"rows {len(rows)}: no-correction {QUIET_COPIES * len(quiet)} ({len(quiet)} x{QUIET_COPIES}), "
      f"correction {len(picked)} (weak {min(len(weak), target)})")
mix = Counter(reason for _, r, _ in rows for reason in r["reasons"])
print("row reasons:", dict(mix.most_common()))
