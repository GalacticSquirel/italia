"""Show exactly what the judge is sent and answers for one planted error. Run from training/."""

import json
from pathlib import Path

from datagen.config import load_config
from datagen.judge import judge_dialogue
from datagen.records import DialogueRecord
from datagen.teacher import make_client

cfg = load_config(Path("datagen/configs/local-mac.yaml"))
print("endpoint:", cfg.judge_endpoint.base_url, cfg.judge_endpoint.model)
rows = [json.loads(line) for line in open("work/datagen/local-v1/judged.jsonl")]
inner = make_client(cfg.judge_endpoint)


class Spy:
    name = inner.name

    def complete(self, messages, **kw):  # type: ignore[no-untyped-def]
        text = "\n".join(m["content"] for m in messages)
        print("prompt chars:", len(text), "| planted text present:", "la machina" in text)
        i = text.find("la machina")
        print("context around it:", text[max(0, i - 300) : i + 80].replace("\n", " | "))
        print("prompt tail:", text[-400:].replace("\n", " | "))
        c = inner.complete(messages, **kw)
        print("RAW:", c.text[:900].replace("\n", " "))
        return c


rec = DialogueRecord.model_validate(rows[4])
turns = list(rec.turns)
i = max(j for j, t in enumerate(turns) if t.output is not None)
out = turns[i].output.model_copy(update={"reply": "Il problema e che la machina non parte."})
turns[i] = turns[i].model_copy(update={"output": out})
res, _ = judge_dialogue(rec.model_copy(update={"turns": turns}), Spy(), max_tokens=cfg.judge.max_tokens)
print("judge field:", res.judge)
