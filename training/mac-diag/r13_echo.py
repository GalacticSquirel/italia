"""Round 13: "Esatto/echo" negatives. On train turns where gold corrects, a round12m sample that gives
no correction AND either opens by affirming ("Esatto", "Giusto", "Perfetto", "Bravo/a", "Bene",
"Sì, esatto", "Ottimo", "Certo") or repeats the gold learner span verbatim is rejected; chosen = gold.
One per turn.
usage (from training/): r13_echo.py subset.jsonl samples.jsonl out.jsonl"""

import json
import random
import re
import sys
from collections import Counter
from pathlib import Path

from datagen.filters import parse_tutor_output
from datagen.jsonutil import read_jsonl
from eval.items import EvalItem

SYSTEMS = ("r13-s1", "r13-s2", "r13-s3", "r13-s4")
AFFIRM = re.compile(r"^\s*(sì,?\s*)?(esatto|esattamente|giusto|perfetto|bravo|brava|bene|benissimo|ottimo|certo|corretto)\b", re.I)
rng = random.Random(20261201)
items = [EvalItem.model_validate(r) for r in read_jsonl(Path(sys.argv[1]))]
samples: dict[str, list[str]] = {}
for r in read_jsonl(Path(sys.argv[2])):
    if r["system"] in SYSTEMS:
        samples.setdefault(r["itemId"], []).append(r["text"])


def norm(s):
    return " ".join(re.sub(r"[^\w\s]", " ", (s or "").lower()).split())


rows, kinds = [], Counter()
for item in items:
    if item.gold.expected_move == "none":
        continue
    span = norm(item.gold.learner_span)
    found = []
    for t in dict.fromkeys(samples.get(item.id, [])):
        p, _ = parse_tutor_output(t)
        if p is None or p.annotations.move != "none":
            continue
        affirm = bool(AFFIRM.search(p.reply))
        echo = bool(span) and len(span.split()) >= 2 and span in norm(p.reply)
        if affirm or echo:
            found.append((t, "affirm" if affirm else "echo"))
    if not found:
        continue
    t, k = rng.choice(found)
    kinds[k] += 1
    rows.append({"id": item.id, "kind": "echo", "sub": k, "level": item.level.value,
                 "move": item.gold.expected_move, "prompt": item.messages,
                 "chosen": [{"role": "assistant", "content": item.reference}],
                 "rejected": [{"role": "assistant", "content": t}]})
with open(sys.argv[3], "w", encoding="utf-8") as out:
    for r in rows:
        out.write(json.dumps(r, ensure_ascii=False) + "\n")
print(f"echo/affirm negatives: {len(rows)} ({dict(kinds)}); by level {dict(sorted(Counter(r['level'] for r in rows).items()))}")
