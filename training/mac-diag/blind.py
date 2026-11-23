"""Blind cross-check export: 40 bench items (seed 7, ~7 per level), round9m-b10 (m-a05-b10) vs
round10-dpo replies randomly placed in slots A/B. Writes the plain-text export and a separate key.
usage (from training/): blind.py export.txt key.json"""

import json
import random
import sys
from pathlib import Path

from datagen.filters import parse_tutor_output
from datagen.jsonutil import read_jsonl
from eval.items import EvalItem

SYS = {"m-a05-b10": "round9m-b10", "round10-dpo": "round10-dpo"}
rng = random.Random(7)
items = [EvalItem.model_validate(r) for r in read_jsonl(Path("work/eval/bench.jsonl"))]
preds: dict[str, dict[str, str]] = {}
for r in read_jsonl(Path("work/eval/bench-predictions.jsonl")):
    if r["system"] in SYS:
        preds.setdefault(r["system"], {})[r["itemId"]] = r["text"]


def reply(text: str | None) -> str:
    p, _ = parse_tutor_output(text or "")
    return p.reply if p else (text or "(no output)")


def norm(s: str) -> str:
    return " ".join(s.lower().split())


# only items where the two replies differ: identical replies carry no preference signal
by_level: dict[str, list[EvalItem]] = {}
same = total = 0
for i in items:
    if all(i.id in preds[s] for s in SYS):
        total += 1
        a, b = (reply(preds[s][i.id]) for s in SYS)
        if norm(a) == norm(b):
            same += 1
            continue
        by_level.setdefault(i.level.value, []).append(i)
print(f"{total} bench items; identical replies {same}; differing {total - same}")


def short_context(system_prompt: str) -> str:
    """The scene part of the system prompt plus the level limits, without the long boilerplate."""
    keep = []
    for line in system_prompt.splitlines():
        if line.startswith(("- Use only these structures", "Feedback:", "Answer with JSON", "Error tags:")):
            if line.startswith("Feedback:"):
                break
            continue
        keep.append(line)
    return "\n".join(line for line in keep if line.strip())
levels = sorted(by_level)
quota = {lv: 7 for lv in levels}
for lv in rng.sample(levels, 7 * len(levels) - 40):  # 6 levels x 7 = 42: two levels get 6
    quota[lv] -= 1
picked = [i for lv in levels for i in rng.sample(by_level[lv], quota[lv])]
rng.shuffle(picked)
key, blocks = {}, []
for n, item in enumerate(picked, 1):
    order = list(SYS)
    rng.shuffle(order)
    key[item.id] = {"A": SYS[order[0]], "B": SYS[order[1]]}
    ctx = short_context(item.messages[0]["content"])
    history = "\n".join(f"  {m['role']}: {reply(m['content']) if m['role'] == 'assistant' else m['content']}"
                        for m in item.messages[1:-1])
    blocks.append(
        f"### {n}. {item.id} ({item.level.value})\n"
        f"CONTEXT:\n{ctx}\n"
        f"EARLIER TURNS:\n{history or '  (none)'}\n"
        f"LEARNER: {item.learner_text}\n"
        f"GOLD: {reply(item.reference)}\n"
        f"A: {reply(preds[order[0]][item.id])}\n"
        f"B: {reply(preds[order[1]][item.id])}\n")
Path(sys.argv[1]).write_text("\n".join(blocks), encoding="utf-8")
Path(sys.argv[2]).write_text(json.dumps(key, indent=1), encoding="utf-8")
print(f"{len(picked)} items, per level {quota}; export {sum(len(b) for b in blocks)} chars")
