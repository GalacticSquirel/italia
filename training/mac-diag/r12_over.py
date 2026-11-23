"""Round 12 prep: on-policy over-correction pair candidates. On gold-none train turns, a sample that
prompts or recasts is a rejected candidate; chosen = a gold-none sample of the same turn (on-policy)
or, if no sample left it alone, the gold turn. Focus tags (word-choice, false-friend, article-use)
are reported separately. Writes all candidates (one per turn, focus-tag rejects preferred).
usage (from training/): r12_over.py subset.jsonl samples.jsonl candidates.jsonl"""

import json
import random
import sys
from collections import Counter, defaultdict
from pathlib import Path

from datagen.filters import parse_tutor_output
from datagen.jsonutil import read_jsonl
from eval.items import EvalItem

FOCUS = {"word-choice", "false-friend", "article-use"}
SYSTEMS = ("r12-s1", "r12-s2", "r12-s3", "r12-s4")
rng = random.Random(20261128)
items = [EvalItem.model_validate(r) for r in read_jsonl(Path(sys.argv[1]))]
samples: dict[str, list[str]] = {}
for r in read_jsonl(Path(sys.argv[2])):
    if r["system"] in SYSTEMS:
        samples.setdefault(r["itemId"], []).append(r["text"])

turns = Counter()
cand = Counter()
focus = Counter()
chosen_src = Counter()
tags_all = Counter()
by_level_tag: dict[str, Counter] = defaultdict(Counter)
rows = []
for item in items:
    if item.gold.expected_move != "none":
        continue
    lv = item.level.value
    turns[lv] += 1
    keep, corrects = [], []
    for t in dict.fromkeys(samples.get(item.id, [])):
        p, _ = parse_tutor_output(t)
        if p is None:
            continue
        if p.annotations.move == "none":
            keep.append(t)
        else:
            corrects.append((t, set(p.annotations.error_tags)))
    if not corrects:
        continue
    cand[lv] += 1
    focused = [c for c in corrects if c[1] & FOCUS]
    rej, tags = rng.choice(focused or corrects)
    tags_all.update(tags)
    by_level_tag[lv].update(tags)
    if tags & FOCUS:
        focus[lv] += 1
    chosen = rng.choice(keep) if keep else item.reference
    chosen_src["sample" if keep else "gold"] += 1
    rows.append({"id": item.id, "kind": "over", "level": lv, "focus": bool(tags & FOCUS),
                 "tags": sorted(tags), "chosenFrom": "sample" if keep else "gold",
                 "prompt": item.messages,
                 "chosen": [{"role": "assistant", "content": chosen}],
                 "rejected": [{"role": "assistant", "content": rej}]})
with open(sys.argv[3], "w", encoding="utf-8") as out:
    for r in rows:
        out.write(json.dumps(r, ensure_ascii=False) + "\n")
print("gold-none turns sampled by level:", dict(sorted(turns.items())))
print("turns with >=1 correcting sample (candidates):", dict(sorted(cand.items())), "total", sum(cand.values()))
print("  of which the rejected carries a focus tag (word-choice/false-friend/article-use):",
      dict(sorted(focus.items())), "total", sum(focus.values()))
print("chosen from:", dict(chosen_src))
print("rejected error tags (top 12):", tags_all.most_common(12))
for lv in sorted(by_level_tag):
    print(f"  {lv} top tags: {by_level_tag[lv].most_common(5)}")
