"""Score the per-turn grammar pass: recall on planted errors and false-flag rate on clean turns,
for each model alone and for the combination rules. usage: grammar_eval.py a.jsonl [b.jsonl]"""

import json
import re
import sys
import unicodedata


def norm(s: str) -> str:
    s = unicodedata.normalize("NFC", s).lower().replace("’", "'")
    return re.sub(r"\s+", " ", re.sub(r"[^\w' ]", " ", s)).strip()


def overlaps(a: str, b: str) -> bool:
    a, b = norm(a), norm(b)
    return bool(a and b) and (a in b or b in a or bool(set(a.split()) & set(b.split())))


runs = {}
for path in sys.argv[1:]:
    rows = [json.loads(line) for line in open(path)]
    runs[rows[0]["model"].split("/")[-1]] = {(r["dialogue"], r["turn"], r["kind"]): r for r in rows}
names = list(runs)
keys = list(runs[names[0]])


def lt_confirms(r: dict, flag: dict) -> bool:
    return any(overlaps(flag["quote"], span) for span in r["lt"])


def flagged(rule: str, key: tuple) -> bool:
    rs = [runs[n][key] for n in names]
    if rule in names:
        return bool(runs[rule][key]["flags"])
    if rule == "any model":
        return any(r["flags"] for r in rs)
    if rule == "both models":
        return all(r["flags"] for r in rs)
    if rule == "confirmed":  # a model flag that LanguageTool or the other model also flags
        for i, r in enumerate(rs):
            for f in r["flags"]:
                others = [g for j, o in enumerate(rs) if j != i for g in o["flags"]]
                if lt_confirms(r, f) or any(overlaps(f["quote"], g["quote"]) for g in others):
                    return True
        return False
    if rule == "LanguageTool":
        return bool(rs[0]["lt"])
    raise ValueError(rule)


rules = [*names, "LanguageTool"]
if len(names) > 1:
    rules += ["any model", "both models", "confirmed"]
else:
    rules += ["confirmed"]
planted = [k for k in keys if k[2] == "planted"]
clean = [k for k in keys if k[2] == "clean"]
print(f"planted turns: {len(planted)}, clean turns: {len(clean)} "
      f"from {len({k[0] for k in clean})} accepted dialogues\n")
print(f"{'setup':16} {'planted caught':>15} {'grammar (5)':>12} {'clean turns flagged':>20}")
for rule in rules:
    caught = [flagged(rule, k) for k in planted]
    grammar = [c for c, k in zip(caught, planted) if runs[names[0]][k]["case"] != 2]
    fp = sum(flagged(rule, k) for k in clean)
    print(f"{rule:16} {sum(caught):>9} / {len(planted)} {sum(grammar):>8} / 5 "
          f"{fp:>10} / {len(clean)} ({100 * fp / len(clean):.0f}%)")

for n in names:
    print(f"\n--- {n}: planted")
    for k in planted:
        r = runs[n][k]
        print(f"  [{r['case']}] {r['reply']!r} -> {[(f['quote'], f['fix']) for f in r['flags']]}"
              f"  LT={r['lt']}")
    print(f"--- {n}: clean turns flagged")
    for k in clean:
        r = runs[n][k]
        if r["flags"]:
            print(f"  {r['reply'][:90]!r} -> {[(f['quote'], f['fix']) for f in r['flags']]}")
