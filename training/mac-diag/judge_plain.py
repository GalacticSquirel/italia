"""Probe: does the judge catch errors when tutor replies are plain numbered text and it must list
errors before any verdict? Same 6 planted dialogues as judge_subtle.py, plus unmodified controls."""

import json
from pathlib import Path

from datagen.config import load_config
from datagen.jsonutil import extract_json_object
from datagen.records import DialogueRecord
from datagen.teacher import make_client

cfg = load_config(Path("datagen/configs/local-mac.yaml"))
rows = [json.loads(line) for line in open("work/datagen/local-v1/judged-qwen.jsonl")]
client = make_client(cfg.judge_endpoint)
subtle = [
    "Quale fermata deve scendere?",
    "E ci sono un balcone o un giardino?",
    "La cucina piccolo? Si dice: la cucina piccola. Ripeti!",
    "Ieri ho andato al mercato con mia sorella.",
    "Il problema e che la machina non parte.",
    "Mi piace molto questa città, è molto belle.",
]

PROMPT = """You are a strict native-Italian proofreader. Below are the replies a tutor wrote in an
Italian lesson. Check every reply, sentence by sentence, for any error in grammar, spelling,
accents, agreement (gender/number), auxiliary choice (essere/avere), or missing prepositions.
Ignore style. Quote each error exactly.

{replies}

First write your analysis: for each reply number, either "ok" or the quoted error and its fix.
Then end with JSON only on the last line: {{"errors": <number of errors found>}}"""


def check(rec: DialogueRecord) -> int:
    replies = [t.output.reply for t in rec.turns if t.output is not None]
    numbered = "\n".join(f"{n}. {r}" for n, r in enumerate(replies, 1))
    c = client.complete(
        [{"role": "user", "content": PROMPT.format(replies=numbered)}],
        temperature=0.0,
        max_tokens=800,
    )
    return int(extract_json_object(c.text[c.text.rfind("{") :]).get("errors", -1))


for k, text in enumerate(subtle):
    rec = DialogueRecord.model_validate(rows[k])
    control = check(rec)
    turns = list(rec.turns)
    i = max(j for j, t in enumerate(turns) if t.output is not None)
    turns[i] = turns[i].model_copy(update={"output": turns[i].output.model_copy(update={"reply": text})})
    planted = check(rec.model_copy(update={"turns": turns}))
    print(f"{text!r:60} control errors={control}  planted errors={planted}  caught={planted > control}")
