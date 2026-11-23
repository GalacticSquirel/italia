"""Round 10b: gold-vs-sample pairs on the hand-written r-reply turns. For each turn, take the
round10-dpo samples (valid JSON, same move as gold) in random order and judge gold against one in
both orders; if gold wins both, chosen = gold, rejected = that sample (one pair per turn; a second
sample is tried only if the first does not lose consistently).
usage (from training/, judge on LOCAL_JUDGE_URL): r10b_reply.py reply-items.jsonl samples.jsonl out.jsonl"""

import json
import random
import sys
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from datagen.config import load_config
from datagen.filters import parse_tutor_output
from datagen.jsonutil import read_jsonl
from datagen.judge import RUBRIC, _PAIRWISE_PROMPT, _conversation_text, _extract
from datagen.teacher import make_client
from eval.items import EvalItem

SYSTEMS = ("r13-s1", "r13-s2")
rng = random.Random(20261123)
judge = make_client(load_config(Path("datagen/configs/local-mac.yaml")).judge_endpoint)
items = [EvalItem.model_validate(r) for r in read_jsonl(Path(sys.argv[1]))]
samples: dict[str, list[str]] = {}
for r in read_jsonl(Path(sys.argv[2])):
    if r["system"] in SYSTEMS:
        samples.setdefault(r["itemId"], []).append(r["text"])


def verdict(item: EvalItem, a: str, b: str) -> str:
    prompt = _PAIRWISE_PROMPT.format(level=item.level.value, system_prompt=item.messages[0]["content"],
                                     conversation=_conversation_text(item.messages), a=a, b=b, rubric=RUBRIC)
    text = judge.complete([{"role": "user", "content": prompt}], temperature=0.0, max_tokens=300,
                          json_output=True).text
    return str(_extract(text).get("winner", "")).strip().upper()


def one(item: EvalItem):
    cands = []
    for t in dict.fromkeys(samples.get(item.id, [])):
        p, _ = parse_tutor_output(t)
        if p is not None and p.annotations.move == item.gold.expected_move and t.strip() != item.reference.strip():
            cands.append(t)
    if not cands:
        return item, "no-candidate", None
    rng.shuffle(cands)
    for t in cands[:2]:
        try:
            w1, w2 = verdict(item, item.reference, t), verdict(item, t, item.reference)
        except Exception:
            return item, "judge-failed", None
        if w1 == "A" and w2 == "B":
            return item, "gold-wins", t
    return item, "no-loss", None


with ThreadPoolExecutor(max_workers=8) as ex:
    results = list(ex.map(one, items))
status = Counter(s for _, s, _ in results)
with open(sys.argv[3], "w", encoding="utf-8") as out:
    for item, s, rej in results:
        if s == "gold-wins":
            out.write(json.dumps({"id": item.id, "kind": "reply", "level": item.level.value,
                                  "move": item.gold.expected_move, "prompt": item.messages,
                                  "chosen": [{"role": "assistant", "content": item.reference}],
                                  "rejected": [{"role": "assistant", "content": rej}]},
                                 ensure_ascii=False) + "\n")
print("r-reply turn status:", dict(status.most_common()))
