import json, sys
from pathlib import Path
from datagen.config import load_config
from datagen.judge import judge_dialogue
from datagen.records import DialogueRecord
from datagen.teacher import make_client

cfg = load_config(Path("datagen/configs/local-mac.yaml"))
rows = [json.loads(l) for l in open("work/datagen/local-v1/judged.jsonl")]
rec = DialogueRecord.model_validate(rows[0])
client = make_client(cfg.judge_endpoint)

class Spy:
    name = client.name
    def complete(self, *a, **k):
        c = client.complete(*a, **k); print("RAW:", c.text[:700].replace("\n", " ")); return c

def run(label, r):
    res, _ = judge_dialogue(r, Spy(), max_tokens=cfg.judge.max_tokens)
    print(label, json.dumps(res.to_wire() if hasattr(res, "to_wire") else str(res))[:400], "\n")

run("ORIGINAL", rec)
turns = list(rec.turns)
i = max(k for k, t in enumerate(turns) if t.output is not None)
bad = turns[i].output.model_copy(update={"reply": "La ragazze sono andato al mercato ieri e io ha comprato una pizze. I think you should say: sono andata. Capito?"})
turns[i] = turns[i].model_copy(update={"output": bad})
run("BROKEN", rec.model_copy(update={"turns": turns}))
