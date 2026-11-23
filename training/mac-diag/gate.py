"""Offline prompt gate: rewrite saved predictions with prompts dropped (annotations.prompt -> null)
under rules a (learnerText covers >=80% of the utterance), b (learnerText not verbatim in the
utterance), c (a or b). Writes original + gated systems to OUT.
usage: gate.py items.jsonl predictions.jsonl OUT sys [sys ...]"""
import json, re, sys
from collections import Counter

items = {json.loads(l)["id"]: json.loads(l) for l in open(sys.argv[1])}
out, systems = sys.argv[3], sys.argv[4:]

def norm(s):
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s']", " ", s.lower())).strip()

def utter(it):
    return next(m["content"] for m in reversed(it["messages"]) if m["role"] == "user")

def rules(span, u):
    s, n = norm(span), norm(u)
    a = len(s) >= 0.8 * len(n) if n else False
    b = s not in n
    return {"a": a, "b": b, "c": a or b}

stats = Counter()
with open(out, "w") as f:
    for l in open(sys.argv[2]):
        p = json.loads(l)
        if p["system"] not in systems:
            continue
        f.write(l if l.endswith("\n") else l + "\n")
        try:
            obj = json.loads(p["text"])
            pr = obj["annotations"].get("prompt")
        except Exception:
            obj, pr = None, None
        fire = rules(pr.get("learnerText") or "", utter(items[p["itemId"]])) if pr else {}
        for r in "abc":
            q = dict(p, system=f"{p['system']}-g{r}")
            if fire.get(r):
                o = json.loads(p["text"]); o["annotations"]["prompt"] = None
                q["text"] = json.dumps(o, ensure_ascii=False)
                stats[(p["system"], r)] += 1
            f.write(json.dumps(q, ensure_ascii=False) + "\n")
        stats[(p["system"], "prompts")] += pr is not None
for s in systems:
    print(s, "prompts", stats[(s, "prompts")], "dropped a/b/c:", stats[(s, "a")], stats[(s, "b")], stats[(s, "c")])
