"""QAT-3 set: the QAT-2 distillation rows; each row where the teacher answers none on a gold-none
turn appears twice; plus the new teacher turns (none only); recast rows duplicated so their share
stays as in QAT-2."""
import json, random
from pathlib import Path
from datagen.filters import parse_tutor_output

rng = random.Random(33)
gold = {}
for f in ("work/qat/distill-items.jsonl", "work/qat2/new-items.jsonl"):
    for l in open(f, encoding="utf-8"):
        r = json.loads(l); gold[r["id"]] = r["gold"]["expectedMove"]

def move(row):
    a = json.loads(row["messages"][-1]["content"])["annotations"]
    return "prompt" if a.get("prompt") else "recast" if a.get("recast") else "none"

old = [json.loads(l) for l in open("work/qat2/sft/sft.train.jsonl", encoding="utf-8")]
items = {json.loads(l)["id"]: json.loads(l) for l in open("work/qat3/new-items.jsonl", encoding="utf-8")}
new, flagged = [], 0
for l in open("work/qat3/teacher-new.jsonl", encoding="utf-8"):
    r = json.loads(l)
    p, _ = parse_tutor_output(r["text"])
    if p is None:
        continue
    it = items[r["itemId"]]
    row = {"id": it["id"], "level": it["level"], "scenarioId": it["scenarioId"],
           "messages": it["messages"] + [{"role": "assistant", "content": p.to_json()}]}
    if move(row) != "none":
        flagged += 1
        continue
    new.append(row)
nn = [r for r in old if move(r) == "none" and gold.get(r["id"]) == "none"]
rec = [r for r in old if move(r) == "recast"]
share = len(rec) / len(old)
x = round(share * (len(nn) + len(new)) / (1 - share))
extra_rec = rng.sample(rec, min(x, len(rec))) + (rng.choices(rec, k=x - len(rec)) if x > len(rec) else [])
train = old + nn + new + extra_rec
rng.shuffle(train)
out = Path("work/qat3/sft"); out.mkdir(parents=True, exist_ok=True)
with open(out / "sft.train.jsonl", "w", encoding="utf-8") as f:
    for row in train:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")
(out / "sft.val.jsonl").write_text(open("work/qat/sft-round12m/sft.val.jsonl", encoding="utf-8").read(), encoding="utf-8")
c = {m: sum(move(r) == m for r in train) for m in ("none", "prompt", "recast")}
print(f"QAT-3 set: {len(train)} rows = {len(old)} QAT-2 + {len(nn)} repeated none-on-correct + {len(new)} new none "
      f"(teacher flagged {flagged} of the new turns, dropped) + {len(extra_rec)} repeated recasts; "
      f"moves {c}; recast share {100*share:.1f}% -> {100*c['recast']/len(train):.1f}%")
