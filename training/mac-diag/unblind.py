"""Unblind the coordinator's 40 verdicts and compare with the bench judge on the same items
(the stored pairwise run keeps only aggregates, so the 40 are re-judged the same way: same
prompt and rubric, both orders, ties/inconsistent = 0.5).
usage (from training/, judge on LOCAL_JUDGE_URL): unblind.py key.json "1:T 2:A ..." """

import json
import sys
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from datagen.config import load_config
from datagen.jsonutil import read_jsonl
from datagen.judge import RUBRIC, _PAIRWISE_PROMPT, _conversation_text, _extract
from datagen.teacher import make_client
from eval.items import EvalItem

key = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
order = list(key)  # insertion order = export order 1..40
verdicts = dict(v.split(":") for v in sys.argv[2].split())
NAME = {"round10-dpo": "round10-dpo", "round9m-b10": "m-a05-b10"}
items = {i.id: i for i in (EvalItem.model_validate(r) for r in read_jsonl(Path("work/eval/bench.jsonl")))}
preds: dict[str, dict[str, str]] = {}
for r in read_jsonl(Path("work/eval/bench-predictions.jsonl")):
    if r["system"] in NAME.values():
        preds.setdefault(r["system"], {})[r["itemId"]] = r["text"]
judge = make_client(load_config(Path("datagen/configs/local-mac.yaml")).judge_endpoint)


def verdict(item: EvalItem, a: str, b: str) -> str:
    prompt = _PAIRWISE_PROMPT.format(level=item.level.value, system_prompt=item.messages[0]["content"],
                                     conversation=_conversation_text(item.messages), a=a, b=b, rubric=RUBRIC)
    text = judge.complete([{"role": "user", "content": prompt}], temperature=0.0, max_tokens=300,
                          json_output=True).text
    return str(_extract(text).get("winner", "")).strip().upper()


def judge_item(item_id: str) -> str:
    item = items[item_id]
    r10, r9 = preds["round10-dpo"][item_id], preds["m-a05-b10"][item_id]
    w1, w2 = verdict(item, r10, r9), verdict(item, r9, r10)
    pts = {"A": 1.0, "TIE": 0.5, "B": 0.0}
    s = (pts.get(w1, 0.5) + 1 - pts.get(w2, 0.5)) / 2
    return "round10" if s > 0.5 else "round9m-b10" if s < 0.5 else "tie"


with ThreadPoolExecutor(max_workers=8) as ex:
    judged = dict(zip(order, ex.map(judge_item, order)))
mine, rows = Counter(), []
agree = n_nontie_both = agree_incl_ties = 0
for n, item_id in enumerate(order, 1):
    v = verdicts[str(n)]
    pick = "tie" if v == "T" else ("round10" if key[item_id][v] == "round10-dpo" else "round9m-b10")
    mine[pick] += 1
    j = judged[item_id]
    agree_incl_ties += pick == j
    if pick != "tie" and j != "tie":
        n_nontie_both += 1
        agree += pick == j
    rows.append(f"{n}. {item_id}: you {pick}, judge {j}")
jc = Counter(judged.values())
print(f"yours: round10 {mine['round10']}, round9m-b10 {mine['round9m-b10']}, tie {mine['tie']}")
print(f"judge: round10 {jc['round10']}, round9m-b10 {jc['round9m-b10']}, tie {jc['tie']}")
print(f"exact agreement (3-way, incl. ties): {agree_incl_ties}/40; "
      f"agreement where both picked a winner: {agree}/{n_nontie_both}")
print("\n".join(rows))
