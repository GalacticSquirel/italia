"""Read-only: LanguageTool over bench reply text, the dialogue builder's way (same client, rules and
suppressions, and learner-echo dropping via without_echoes). Per system: share of replies with an
error, errors per 100 words (also without echo dropping, as eval report counts today), top 10 rules.
Writes flagged replies of FLAG_SYSTEM to argv[1].
usage (from training/): lt_replies.py flagged.jsonl"""

import json
import sys
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from datagen.filters import parse_tutor_output
from datagen.jsonutil import read_jsonl
from datagen.languagetool import LanguageToolClient, without_echoes
from datagen.lemmas import tokenize
from eval.items import EvalItem

SYSTEMS = ("round5-sft", "round6-sft", "round7-sft", "teacher-reference")
FLAG_SYSTEM = "round7-sft"
lt = LanguageToolClient("http://localhost:8010/v2")
items = [EvalItem.model_validate(r) for r in read_jsonl(Path("work/eval/bench.jsonl"))]
preds: dict[str, dict[str, str]] = {}
for r in read_jsonl(Path("work/eval/bench-predictions.jsonl")):
    preds.setdefault(r["system"], {})[r["itemId"]] = r["text"]
preds["teacher-reference"] = {i.id: i.reference for i in items}


def reply_of(text: str) -> str | None:
    p, _ = parse_tutor_output(text or "")
    return None if p is None else p.reply


flagged_out = open(sys.argv[1], "w", encoding="utf-8")
for system in SYSTEMS:
    rows = [(i, reply_of(preds[system][i.id])) for i in items if i.id in preds[system]]
    rows = [(i, r) for i, r in rows if r]
    with ThreadPoolExecutor(max_workers=8) as ex:
        raw = list(ex.map(lambda ir: lt.check(ir[1]), rows))
    words = sum(len(tokenize(r)) for _, r in rows)
    kept_all, rules, any_err, any_err_raw, n_raw = [], Counter(), 0, 0, 0
    for (item, reply), matches in zip(rows, raw, strict=True):
        kept = without_echoes(matches, reply, item.learner_text)
        n_raw += len(matches)
        any_err_raw += bool(matches)
        any_err += bool(kept)
        kept_all.extend(kept)
        rules.update(m.rule_id for m in kept)
        if system == FLAG_SYSTEM:
            for m in kept:
                flagged_out.write(json.dumps({"id": item.id, "reply": reply, "rule": m.rule_id,
                                              "matched": m.span(reply)}, ensure_ascii=False) + "\n")
    n = len(rows)
    print(f"{system}: replies {n}, words {words}; with >=1 LT error {any_err/n:.1%} "
          f"({any_err}); errors/100 words {100*len(kept_all)/words:.2f} | without echo drop: "
          f"{any_err_raw/n:.1%}, {100*n_raw/words:.2f}/100w")
    print("  top rules: " + ", ".join(f"{r} {c}" for r, c in rules.most_common(10)))
flagged_out.close()
