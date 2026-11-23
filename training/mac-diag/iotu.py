"""Read-only: count recast annotations whose learner span is 1st person and whose fix is 2nd person.
usage: iotu.py sft.train.jsonl [more.jsonl ...]  (rows: {id, messages}; hw-* ids are hand-written)"""

import json
import re
import sys
from collections import defaultdict

FIRST = re.compile(r"\b(io|ho|sono|mio|mia|miei|mie|mi)\b|\bho\s+\w+(?:ato|uto|ito|ata|uta|ita)\b", re.I)
SECOND = re.compile(r"\b(hai|sei|tuo|tua|tuoi|tue)\b", re.I)

stats = defaultdict(lambda: {"rows": 0, "rows_with_switch": 0, "recasts": 0, "switch": 0, "examples": []})
for path in sys.argv[1:]:
    for line in open(path, encoding="utf-8"):
        row = json.loads(line)
        group = "handwritten" if row["id"].startswith("hw-") else "round1-generated"
        s = stats[group]
        s["rows"] += 1
        hit = False
        for m in row["messages"]:
            if m["role"] != "assistant":
                continue
            try:
                rec = json.loads(m["content"])["annotations"].get("recast")
            except (ValueError, KeyError, AttributeError):
                continue
            if not rec:
                continue
            s["recasts"] += 1
            span, fix = rec.get("learnerText") or "", rec.get("correctedText") or ""
            if FIRST.search(span) and SECOND.search(fix) and not SECOND.search(span):
                s["switch"] += 1
                hit = True
                if len(s["examples"]) < 10:
                    s["examples"].append((row["id"], span, fix))
        s["rows_with_switch"] += hit

for group, s in stats.items():
    share = s["switch"] / s["recasts"] if s["recasts"] else 0
    print(f"{group}: rows {s['rows']}, recasts {s['recasts']}, io->tu {s['switch']} ({share:.1%}), "
          f"rows containing one {s['rows_with_switch']}")
    for ex in s["examples"]:
        print("   ", json.dumps(ex, ensure_ascii=False))
