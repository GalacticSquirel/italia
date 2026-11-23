"""Read-only: re-judge round7-sft vs round6-sft on the same 300-item sample eval report used
(random.Random(config.seed).sample over items both systems predicted), keeping the judge's reasons,
and compute reply-style stats over all bench items for round6, round7 and the teacher reference.
usage (from training/, judge on LOCAL_JUDGE_URL): r7_losses.py out.jsonl"""

import json
import random
import re
import statistics
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from datagen.config import load_config
from datagen.filters import parse_tutor_output
from datagen.jsonutil import read_jsonl
from datagen.judge import RUBRIC, _PAIRWISE_PROMPT, _conversation_text, _extract
from datagen.teacher import make_client
from eval.items import EvalItem
from eval.metrics import _norm

OURS, THEIRS = "round7-sft", "round6-sft"
config = load_config(Path("datagen/configs/local-mac.yaml"))
judge = make_client(config.judge_endpoint)
items = [EvalItem.model_validate(r) for r in read_jsonl(Path("work/eval/bench.jsonl"))]
preds: dict[str, dict[str, str]] = {}
for r in read_jsonl(Path("work/eval/bench-predictions.jsonl")):
    preds.setdefault(r["system"], {})[r["itemId"]] = r["text"]
preds["teacher-reference"] = {i.id: i.reference for i in items}


def parsed(text: str):
    p, _ = parse_tutor_output(text or "")
    return p


def move(text: str) -> str:
    p = parsed(text)
    return "invalid" if p is None else p.annotations.move


def reply(text: str) -> str:
    p = parsed(text)
    return text if p is None else p.reply


# --- 1. losses -----------------------------------------------------------------------------
pool = [i for i in items if i.id in preds[OURS] and i.id in preds[THEIRS]]
sample = random.Random(config.seed).sample(pool, 300) if len(pool) > 300 else pool


def verdict(item: EvalItem, a: str, b: str) -> tuple[str, str]:
    prompt = _PAIRWISE_PROMPT.format(level=item.level.value, system_prompt=item.messages[0]["content"],
                                     conversation=_conversation_text(item.messages), a=a, b=b, rubric=RUBRIC)
    text = judge.complete([{"role": "user", "content": prompt}], temperature=0.0, max_tokens=300,
                          json_output=True).text
    raw = _extract(text)
    return str(raw.get("winner", "")).strip().upper(), str(raw.get("reason", ""))


def one(item: EvalItem):
    ours, theirs = preds[OURS][item.id], preds[THEIRS][item.id]
    try:
        w1, r1 = verdict(item, ours, theirs)   # round7 as A
        w2, r2 = verdict(item, theirs, ours)   # round6 as A
    except Exception:
        return None
    pts = {"A": 1.0, "TIE": 0.5, "B": 0.0}
    if w1 not in pts or w2 not in pts:
        return None
    score = (pts[w1] + (1 - pts[w2])) / 2
    return item, score, r1, r2


with ThreadPoolExecutor(max_workers=8) as ex:
    results = [r for r in ex.map(one, sample) if r is not None]
scores = [s for _, s, _, _ in results]
losses = [r for r in results if r[1] < 0.5]
with open(sys.argv[1], "w", encoding="utf-8") as out:
    for item, score, r1, r2 in losses:
        out.write(json.dumps({
            "id": item.id, "level": item.level.value, "learnerText": item.learner_text,
            "goldMove": item.gold.expected_move, "score": score,
            "r6move": move(preds[THEIRS][item.id]), "r6reply": reply(preds[THEIRS][item.id]),
            "r7move": move(preds[OURS][item.id]), "r7reply": reply(preds[OURS][item.id]),
            "reasonR7asA": r1, "reasonR6asA": r2,
        }, ensure_ascii=False) + "\n")
print(f"re-judged {len(results)}/{len(sample)}: round7 win rate {sum(scores)/len(scores):.1%}; "
      f"round6 wins {len(losses)}, ties/inconsistent {sum(1 for s in scores if s == 0.5)}, "
      f"round7 wins {sum(1 for s in scores if s > 0.5)}")

# --- 2/3. style stats over all bench items -------------------------------------------------
INTERJ = re.compile(r"^\s*(che bell[oa]|brav[oa]|ah\b|oh\b|ottimo|perfetto|esatto|benissimo|bene\b|"
                    r"che peccato|grazie|certo|davvero|interessante|fantastico|mi dispiace|capisco)", re.I)


def stats(system: str) -> str:
    replies, recasts, wide = [], 0, 0
    for item in items:
        text = preds[system].get(item.id)
        if text is None:
            continue
        p = parsed(text)
        r = reply(text)
        replies.append(r)
        if p is not None and p.annotations.recast is not None:
            rec = p.annotations.recast
            recasts += 1
            # "rewrites more than the error span": fix is >2 words longer than the learner span,
            # or shares under half of the span's words
            span_w, fix_w = _norm(rec.learner_text).split(), _norm(rec.corrected_text).split()
            overlap = len(set(span_w) & set(fix_w)) / max(1, len(set(span_w)))
            if len(fix_w) > len(span_w) + 2 or overlap < 0.5:
                wide += 1
    words = [len(r.split()) for r in replies]
    q = sum(1 for r in replies if r.rstrip().endswith("?"))
    ij = sum(1 for r in replies if INTERJ.search(r))
    s = (f"{system}: n {len(replies)}, words mean {statistics.mean(words):.1f} median "
         f"{statistics.median(words):.0f}, ends with ? {q/len(replies):.1%}, opens with interjection "
         f"{ij/len(replies):.1%}")
    if recasts:
        s += f", recasts {recasts} of which wider-than-span {wide} ({wide/recasts:.1%})"
    return s


for system in ("round6-sft", "round7-sft", "teacher-reference"):
    print(stats(system))
