"""Deterministic echo filter on verified flags: drop a flag when the turn's own annotations show it
quotes the learner (prompt/recast learnerText shares most of its words), or when the flagged text
sits inside quotation marks in the reply (a metalinguistic mention like Non si dice 'la arancia').
usage: grammar_echo.py judged.jsonl in.jsonl out.jsonl"""

import json
import re
import sys
import unicodedata


def words(s: str) -> list[str]:
    s = unicodedata.normalize("NFC", s).lower().replace("’", "'")
    return re.findall(r"[\w']+", s)


def quoted_spans(reply: str) -> list[str]:
    return re.findall(r"['‘“\"«]([^'’”\"»]{2,})['’”\"»]", reply)


records = {}
for line in open(sys.argv[1]):
    r = json.loads(line)
    records[r["id"]] = r


def echoes(row: dict, flag: dict) -> bool:
    rec = records.get(row["dialogue"])
    q = set(words(flag["quote"]))
    if not q:
        return False
    if rec is not None and row["kind"] == "clean":
        ann = rec["turns"][row["turn"]]["output"]["annotations"]
        for fb in (ann.get("prompt"), ann.get("recast")):
            if fb and len(q & set(words(fb["learnerText"]))) >= max(1, len(q) // 2):
                return True
    for span in quoted_spans(row["reply"]):
        if set(words(span)) & q and set(words(span)) <= q | set(words(span)):
            if q & set(words(span)):
                return True
    return False


with open(sys.argv[3], "w") as out:
    for line in open(sys.argv[2]):
        row = json.loads(line)
        row["flags"] = [f for f in row["flags"] if not echoes(row, f)]
        row["model"] = row["model"] + " +echo"
        out.write(json.dumps(row, ensure_ascii=False) + "\n")
print("->", sys.argv[3])
