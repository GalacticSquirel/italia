"""Does the local judge catch the subtle mistakes the teacher actually makes? Run from training/."""

import json
from pathlib import Path

from datagen.config import load_config
from datagen.judge import judge_dialogue
from datagen.records import DialogueRecord
from datagen.teacher import make_client

cfg = load_config(Path("datagen/configs/local-mac.yaml"))
rows = [json.loads(line) for line in open("work/datagen/local-v1/judged.jsonl")]
client = make_client(cfg.judge_endpoint)
subtle = [
    "Quale fermata deve scendere?",  # missing preposition: A quale fermata
    "E ci sono un balcone o un giardino?",  # agreement: c'è un balcone
    "La cucina piccolo? Si dice: la cucina piccola. Ripeti!",  # prompt gives the answer
    "Ieri ho andato al mercato con mia sorella.",  # auxiliary: sono andato
    "Il problema e che la machina non parte.",  # è, macchina
    "Mi piace molto questa città, è molto belle.",  # agreement: bella
]
for k, text in enumerate(subtle):
    rec = DialogueRecord.model_validate(rows[k])
    if k == 0:
        clean, _ = judge_dialogue(rec, client, max_tokens=cfg.judge.max_tokens)
        print(f"{'(unmodified dialogue)':60} gram={clean.scores.grammaticality} overall={clean.overall:.2f} issues={len(clean.issues)} accepted={cfg.judge.accepts(clean.scores)}")
    turns = list(rec.turns)
    i = max(j for j, t in enumerate(turns) if t.output is not None)
    out = turns[i].output.model_copy(update={"reply": text})
    turns[i] = turns[i].model_copy(update={"output": out})
    res, _ = judge_dialogue(
        rec.model_copy(update={"turns": turns}), client, max_tokens=cfg.judge.max_tokens
    )
    s = res.scores
    print(
        f"{text!r:60} gram={s.grammaticality} feedback={s.feedback} "
        f"withholds={s.prompt_withholds} overall={res.overall:.2f} issues={len(res.issues)} "
        f"accepted={cfg.judge.accepts(s)}"
    )
