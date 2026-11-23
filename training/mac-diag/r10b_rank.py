"""Round 10b: reply-quality DPO pairs from 4 T=0.9 samples of round10-dpo per turn.
Filter: valid JSON, move = gold move, span fuzzy-matches the gold span (corrections), and no
LanguageTool error in the reply that is not an echo of the learner. For turns with >= 2 distinct
survivors, the bench judge (same pairwise prompt and rubric) compares two of them in both orders;
only order-consistent wins become pairs (chosen = winner). Turns where every sample has a non-echo
LT error and gold has none add chosen = gold, rejected = the sample with the most errors (capped
at 20% of all pairs). At most one pair per turn.
usage (from training/, judge on LOCAL_JUDGE_URL): r10_rank.py subset.jsonl samples.jsonl pairs.jsonl"""

import json
import random
import re
import sys
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from datagen.config import load_config
from datagen.filters import parse_tutor_output
from datagen.jsonutil import read_jsonl
from datagen.judge import RUBRIC, _PAIRWISE_PROMPT, _conversation_text, _extract
from datagen.languagetool import LanguageToolClient, without_echoes
from datagen.teacher import make_client
from eval.items import EvalItem

SYSTEMS = ("r10b-s1", "r10b-s2", "r10b-s3", "r10b-s4")
GOLD_SHARE = 0.2
rng = random.Random(20261121)
config = load_config(Path("datagen/configs/local-mac.yaml"))
judge = make_client(config.judge_endpoint)
lt = LanguageToolClient("http://localhost:8010/v2")
items = [EvalItem.model_validate(r) for r in read_jsonl(Path(sys.argv[1]))]
samples: dict[str, list[str]] = {}
for r in read_jsonl(Path(sys.argv[2])):
    if r["system"] in SYSTEMS:
        samples.setdefault(r["itemId"], []).append(r["text"])


def words(s: str) -> set[str]:
    return set(re.sub(r"[^\w\s]", " ", (s or "").lower()).split())


def lt_errors(reply: str, learner: str) -> int:
    return len(without_echoes(lt.check(reply), reply, learner))


def survives(item: EvalItem, ref, text: str) -> bool:
    pred, _ = parse_tutor_output(text)
    if pred is None or pred.annotations.move != item.gold.expected_move:
        return False
    if item.gold.expected_move != "none":
        fb = pred.annotations.prompt or pred.annotations.recast
        gfb = ref.annotations.prompt or ref.annotations.recast
        gold_span = words(item.gold.learner_span or (gfb.learner_text if gfb else ""))
        if gold_span and len(words(fb.learner_text) & gold_span) / len(gold_span) < 0.5:
            return False
    return lt_errors(pred.reply, item.learner_text) == 0


def verdict(item: EvalItem, a: str, b: str) -> str:
    prompt = _PAIRWISE_PROMPT.format(level=item.level.value, system_prompt=item.messages[0]["content"],
                                     conversation=_conversation_text(item.messages), a=a, b=b, rubric=RUBRIC)
    text = judge.complete([{"role": "user", "content": prompt}], temperature=0.0, max_tokens=300,
                          json_output=True).text
    return str(_extract(text).get("winner", "")).strip().upper()


def one(item: EvalItem):
    ref, _ = parse_tutor_output(item.reference)
    texts = list(dict.fromkeys(samples.get(item.id, [])))  # distinct, order kept
    if ref is None or not texts:
        return item, "none", None
    alive = [t for t in texts if survives(item, ref, t)]
    if len(alive) >= 2:
        x, y = rng.sample(alive, 2)
        try:
            w1, w2 = verdict(item, x, y), verdict(item, y, x)
        except Exception:
            return item, "judge-failed", None
        if w1 == "A" and w2 == "B":
            return item, "judged", (x, y)
        if w1 == "B" and w2 == "A":
            return item, "judged", (y, x)
        return item, "inconsistent", None
    # gold-vs-worst: every sample has a non-echo LT error and gold has none
    parsed = [(t, parse_tutor_output(t)[0]) for t in texts]
    errs = [(lt_errors(p.reply, item.learner_text) if p else 99, t) for t, p in parsed]
    if all(e > 0 for e, _ in errs) and lt_errors(ref.reply, item.learner_text) == 0:
        worst = max(errs)[1]
        return item, "gold", (item.reference, worst)
    return item, f"survivors-{len(alive)}", None


with ThreadPoolExecutor(max_workers=8) as ex:
    results = list(ex.map(one, items))
status = Counter(s for _, s, _ in results)
judged = [(i, p) for i, s, p in results if s == "judged"]
gold = [(i, p) for i, s, p in results if s == "gold"]
cap = int(GOLD_SHARE / (1 - GOLD_SHARE) * len(judged))
if len(gold) > cap:
    gold = rng.sample(gold, cap)
rows = []
for kind, group in (("judged", judged), ("gold", gold)):
    for item, (chosen, rejected) in group:
        rows.append({"id": item.id, "kind": kind, "level": item.level.value,
                     "move": item.gold.expected_move, "prompt": item.messages,
                     "chosen": [{"role": "assistant", "content": chosen}],
                     "rejected": [{"role": "assistant", "content": rejected}]})
rng.shuffle(rows)
with open(sys.argv[3], "w", encoding="utf-8") as out:
    for r in rows:
        out.write(json.dumps(r, ensure_ascii=False) + "\n")
print("turn status:", dict(status.most_common()))
print(f"pairs {len(rows)}: judged {len(judged)}, gold-vs-worst {len(gold)} (cap {cap})")
for lv in sorted({r["level"] for r in rows}):
    c = Counter(r["kind"] for r in rows if r["level"] == lv)
    m = Counter(r["move"] for r in rows if r["level"] == lv)
    print(f"  {lv}: judged {c['judged']}, gold {c['gold']} | moves {dict(m)}")
