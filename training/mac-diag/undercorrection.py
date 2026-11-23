"""Under-correction by gold target tag and by level, per system (same definition as
eval.metrics: of the items whose gold move is prompt/recast, the share predicted "none";
unparseable predictions are "invalid", not "none").
usage: undercorrection.py items.jsonl predictions.jsonl system [system ...]"""

import json
import sys
from collections import Counter, defaultdict

from datagen.filters import parse_tutor_output

items = {}
for line in open(sys.argv[1]):
    it = json.loads(line)
    items[it["id"]] = it
systems = sys.argv[3:]
preds: dict[str, dict[str, str]] = defaultdict(dict)
for line in open(sys.argv[2]):
    p = json.loads(line)
    preds[p["system"]][p["itemId"]] = p["text"]


def move(text: str) -> str:
    pred, _errors = parse_tutor_output(text)  # the eval's own parser: schema-invalid is invalid
    return "invalid" if pred is None else pred.annotations.move


by_tag: dict[str, dict[str, Counter[str]]] = {s: defaultdict(Counter) for s in systems}
by_level: dict[str, dict[str, Counter[str]]] = {s: defaultdict(Counter) for s in systems}
for item_id, it in items.items():
    gold = it.get("gold") or {}
    if gold.get("expectedMove", "none") == "none":
        continue
    tag = gold.get("targetTag") or "?"
    for s in systems:
        m = move(preds[s].get(item_id, ""))
        for table, key in ((by_tag[s], tag), (by_level[s], it["level"])):
            table[key]["due"] += 1
            table[key]["missed"] += m == "none"


def pct(c: Counter[str]) -> str:
    return f"{100 * c['missed'] / c['due']:.0f}%" if c["due"] else "-"


total = {s: Counter() for s in systems}
for s in systems:
    for c in by_level[s].values():
        total[s].update(c)
print("Overall under-correction: " + ", ".join(f"{s} {pct(total[s])} ({total[s]['missed']}/{total[s]['due']})" for s in systems))
print("\n| Level | Due | " + " | ".join(systems) + " |")
print("|---|---|" + "---|" * len(systems))
for lvl in sorted(by_level[systems[0]]):
    print(f"| {lvl} | {by_level[systems[0]][lvl]['due']} | " + " | ".join(pct(by_level[s][lvl]) for s in systems) + " |")
print("\n| Target tag | Due | " + " | ".join(systems) + " |")
print("|---|---|" + "---|" * len(systems))
for tag, c in sorted(by_tag[systems[0]].items(), key=lambda kv: -kv[1]["due"]):
    print(f"| {tag} | {c['due']} | " + " | ".join(pct(by_tag[s][tag]) for s in systems) + " |")
