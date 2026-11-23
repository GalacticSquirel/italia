"""Print the raw assess answer for prompt/recast turns where no JSON object can be extracted."""

import json
import sys
from pathlib import Path

from datagen.config import load_config
from datagen.feedback_check import ASSESS_MAX_TOKENS, ASSESS_PROMPT, _learner_before
from datagen.grammar_check import scene
from datagen.jsonutil import JsonExtractError, extract_json_object
from datagen.records import DialogueRecord
from datagen.teacher import make_client

cfg = load_config(Path("datagen/configs/local-mac.yaml"))
client = make_client(cfg.judge_endpoint)
rows = [json.loads(line) for line in open(sys.argv[1])]
start = int(sys.argv[2])
bad = 0
for r in rows[start : start + 20]:
    rec = DialogueRecord.model_validate(r)
    ctx = scene(rec)
    for i, t in enumerate(rec.turns):
        if t.output is None:
            continue
        ann = t.output.annotations
        fb = ann.prompt or ann.recast
        if fb is None:
            continue
        prompt = ASSESS_PROMPT.format(
            setting=ctx["setting"], tutor_role=ctx["tutor_role"], learner_role=ctx["learner_role"],
            gender=ctx["gender"], learner=_learner_before(rec.turns, i), reply=t.output.reply,
            move="PROMPT" if ann.prompt else "RECAST", learner_text=fb.learner_text,
        )
        c = client.complete([{"role": "user", "content": prompt}], temperature=0.0,
                            max_tokens=ASSESS_MAX_TOKENS, json_output=True)
        try:
            extract_json_object(c.text)
        except JsonExtractError:
            bad += 1
            print(f"--- {rec.id} turn {i} output_tokens={c.usage.output_tokens}\n{c.text[:600]}\n")
print("unparseable:", bad)
