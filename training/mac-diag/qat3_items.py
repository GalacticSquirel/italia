"""QAT-3 new distillation items: ~600 unused train-split turns whose gold move is none and whose
reference also leaves them alone; short (<= 8 words) A1-B1 utterances and correct advanced
constructions (subjunctive after che/conjunctions, comparatives, adverb/word-order markers) at
B2/C2 (the train split has no C1 items)."""
import collections, glob, json, random, re

rng = random.Random(20261122)
used = set()
for f in glob.glob("work/dpo-round*/*subset*.jsonl") + ["work/qat/distill-items.jsonl", "work/qat2/new-items.jsonl"]:
    used |= {json.loads(l)["id"] for l in open(f)}
ADV = re.compile(
    r"\b(che|affinché|perché|benché|sebbene|prima che|senza che|purché|qualora)\b.*\b\w+(essi|esse|essimo|este|essero|asse|assi|assero|isse|issero|ia|iano|iamo|iate)\b"
    r"|\b(più|meno)\b.*\b(che|di)\b|\b(decisamente|davvero|proprio|ormai|tuttavia|comunque)\b", re.I)
cells = collections.defaultdict(list)
for l in open("work/dpo-round9/train-items.jsonl"):
    r = json.loads(l)
    if r["id"] in used or r["gold"]["expectedMove"] != "none":
        continue
    ref = json.loads(r["reference"])["annotations"]
    if ref.get("prompt") or ref.get("recast"):
        continue
    u = next(m["content"] for m in reversed(r["messages"]) if m["role"] == "user")
    short, adv = len(u.split()) <= 8, bool(ADV.search(u))
    lv = r["level"]
    if lv in ("A1", "A2", "B1") and short:
        cells[(lv, "short")].append(l)
    elif lv in ("B2", "C2") and adv:
        cells[(lv, "adv")].append(l)
QUOTA = {("A1", "short"): 140, ("A2", "short"): 120, ("B1", "short"): 120, ("B2", "adv"): 70, ("C2", "adv"): 150}
out = []
for k, q in QUOTA.items():
    out += rng.sample(cells[k], min(q, len(cells[k])))
rng.shuffle(out)
open("work/qat3/new-items.jsonl", "w").writelines(out)
print("QAT-3 new items", len(out), {f"{k[0]}-{k[1]}": min(q, len(cells[k])) for k, q in QUOTA.items()},
      "available", {f"{k[0]}-{k[1]}": len(v) for k, v in cells.items()})
