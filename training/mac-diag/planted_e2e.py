"""End to end: are the planted-error dialogues rejected by judge + acceptance now?"""

import json
from pathlib import Path

from datagen.config import load_config
from datagen.judge import judge_dialogue
from datagen.records import DialogueRecord
from datagen.teacher import make_client
from spec.models import Turn

PLANTED = [
    "Quale fermata deve scendere?",
    "E ci sono un balcone o un giardino?",
    "La cucina piccolo? Si dice: la cucina piccola. Ripeti!",
    "Ieri ho andato al mercato con mia sorella.",
    "Il problema e che la machina non parte.",
    "Mi piace molto questa città, è molto belle.",
]
cfg = load_config(Path("datagen/configs/local-mac.yaml"))
client = make_client(cfg.judge_endpoint)
rows = [json.loads(line) for line in open(Path.home() / "italia-diag/judged-qwen-1796.jsonl")]
for k, text in enumerate(PLANTED):
    rec = DialogueRecord.model_validate(rows[k])
    turns = list(rec.turns)
    i = max(j for j, t in enumerate(turns) if t.output is not None)
    turns[i] = Turn(role="tutor", text=text, output=turns[i].output.model_copy(update={"reply": text}))
    res, _ = judge_dialogue(
        rec.model_copy(update={"turns": turns}), client,
        max_tokens=cfg.judge.max_tokens, grammar_check=cfg.judge.grammar_check,
    )
    print(f"{text!r:58} grammaticality={res.scores.grammaticality} "
          f"promptWithholds={res.scores.prompt_withholds} accepted={cfg.judge.accepts(res.scores)}")
