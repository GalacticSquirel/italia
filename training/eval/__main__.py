"""Evaluation CLI. Run from `training/`: `uv run python -m eval <command> ...`.

build-items  held-out items from accepted eval-split dialogues (a datagen eval config's
             accepted dialogues, or compiled benchmark sets with --records)
predict      run a system from eval/configs/systems.yaml over the items
report       score systems, optional judge win rates and llama-bench results -> markdown
learner-items   held-out real learner sentences with native corrections (MERLIN)
learner-report  score systems on the learner items -> markdown
"""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path
from typing import Any

from datagen.__main__ import band_checker, grammar_checker
from datagen.config import load_config
from datagen.jsonutil import read_jsonl, write_jsonl
from datagen.learner_corpus import DEFAULT_PAIRS, LearnerPair
from datagen.records import DialogueRecord
from datagen.runner import accepted_records
from datagen.teacher import make_client
from eval.items import EvalItem, build_items
from eval.learner import LearnerItem, build_learner_items, render_learner_report, score_learner
from eval.metrics import score_system
from eval.pairwise import WinRate, compare
from eval.predict import load_predictions, load_systems, predict, reference_predictions
from eval.report import BenchRow, parse_llama_bench, render_report, summary_json
from eval.shipped import shipped_predictions

REFERENCE = "teacher-reference"
_AS_SHIPPED = (
    "score corrections the app would show (what postValidate in packages/core keeps); "
    "'strict' drops every quoted span not found exactly instead of snapping near misses"
)


def load_items(path: Path) -> list[EvalItem]:
    return [EvalItem.model_validate(r) for r in read_jsonl(path)]


def load_learner_items(path: Path) -> list[LearnerItem]:
    return [LearnerItem.model_validate(r) for r in read_jsonl(path)]


def load_any_items(path: Path) -> list[EvalItem] | list[LearnerItem]:
    """Benchmark items or learner items, told apart by the learner items' native text."""
    rows = list(read_jsonl(path))
    if rows and "nativeText" in rows[0]:
        return [LearnerItem.model_validate(r) for r in rows]
    return [EvalItem.model_validate(r) for r in rows]


def benchmark_records(patterns: list[str]) -> list[DialogueRecord]:
    """Passing records of compiled benchmark sets (paths or globs relative to training/)."""
    out: list[DialogueRecord] = []
    for pattern in patterns:
        paths = sorted(Path().glob(pattern)) or [Path(pattern)]
        for path in paths:
            for row in read_jsonl(path):
                record = DialogueRecord.model_validate(row)
                if record.filter is not None and record.filter.passed:
                    out.append(record)
    return out


def cmd_build_items(args: argparse.Namespace) -> int:
    records: list[DialogueRecord] = []
    if args.config:
        records += accepted_records(load_config(Path(args.config)))
    records += benchmark_records(args.records or [])
    if not records:
        raise SystemExit("no records: pass -c CONFIG and/or --records 'data/bench/*.jsonl'")
    items = build_items(records, max_per_dialogue=args.max_per_dialogue)
    write_jsonl(Path(args.out), (i.to_wire() for i in items))
    print(f"{len(items)} items -> {args.out}")
    return 0


def cmd_predict(args: argparse.Namespace) -> int:
    systems = load_systems(Path(args.systems))
    items = load_any_items(Path(args.items))
    if args.limit:
        items = items[: args.limit]
    for name in args.system:
        added = predict(systems[name], items, Path(args.out))
        print(f"{name}: {added} new predictions -> {args.out}")
    return 0


def cmd_report(args: argparse.Namespace) -> int:
    config = load_config(Path(args.config))
    items = load_items(Path(args.items))
    predictions: dict[str, dict[str, str]] = {REFERENCE: reference_predictions(items)}
    for name in args.system:
        predictions[name] = load_predictions(Path(args.predictions), name)
    if args.as_shipped:
        learner_texts = {i.id: i.learner_text for i in items}
        strict = args.as_shipped == "strict"
        predictions = {
            n: shipped_predictions(p, learner_texts, strict=strict) for n, p in predictions.items()
        }
    checker = band_checker(config)
    grammar = grammar_checker(config, args.no_languagetool)
    scores = [
        score_system(
            name, items, preds, band_checker=checker, grammar=grammar, filters=config.filters
        )
        for name, preds in predictions.items()
    ]
    win_rates: list[WinRate] = []
    if args.pairwise:
        judge = make_client(config.judge_endpoint)
        for pair in args.pairwise:
            ours, theirs = pair.split(":")
            win_rates.append(
                compare(
                    ours,
                    theirs,
                    items,
                    predictions[ours],
                    predictions[theirs],
                    judge=judge,
                    sample=args.pairwise_sample,
                    seed=config.seed,
                )
            )
    bench: list[BenchRow] = []
    for spec in args.bench or []:
        device, path = spec.split("=", 1)
        bench += parse_llama_bench(Path(path).read_text(encoding="utf-8"), device)
    report = render_report(
        args.title, scores, win_rates, bench, notes=args.note or [], reference=REFERENCE
    )
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(report, encoding="utf-8")
    out.with_suffix(".json").write_text(
        json.dumps(summary_json(scores, win_rates), indent=2), encoding="utf-8"
    )
    print(f"report -> {out}")
    return 0


def cmd_learner_items(args: argparse.Namespace) -> int:
    pairs = [LearnerPair.model_validate(r) for r in read_jsonl(Path(args.pairs))]
    items = build_learner_items(pairs, per_group=args.per_group, seed=args.seed)
    write_jsonl(Path(args.out), (i.to_wire() for i in items))
    print(f"{len(items)} learner items -> {args.out}")
    return 0


def cmd_learner_report(args: argparse.Namespace) -> int:
    items = load_learner_items(Path(args.items))
    learner_texts = {i.id: i.learner_text for i in items} if args.as_shipped else {}
    scores = [
        score_learner(
            name,
            items,
            shipped_predictions(
                load_predictions(Path(args.predictions), name),
                learner_texts,
                strict=args.as_shipped == "strict",
            ),
        )
        for name in args.system
    ]
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(render_learner_report(args.title, scores), encoding="utf-8")
    print(f"report -> {out}")
    return 0


def _learner_commands(sub: Any) -> None:
    p = sub.add_parser("learner-items")
    p.add_argument("--pairs", default=str(DEFAULT_PAIRS))
    p.add_argument("--per-group", type=int, default=150, help="per level, changed and unchanged")
    p.add_argument("--seed", type=int, default=0)
    p.add_argument("--out", required=True)
    p.set_defaults(fn=cmd_learner_items)
    p = sub.add_parser("learner-report")
    p.add_argument("--items", required=True)
    p.add_argument("--predictions", required=True)
    p.add_argument("--system", action="append", required=True)
    p.add_argument("--title", default="Real-learner check (MERLIN)")
    p.add_argument(
        "--as-shipped", nargs="?", const="snap", choices=["snap", "strict"], help=_AS_SHIPPED
    )
    p.add_argument("--out", required=True)
    p.set_defaults(fn=cmd_learner_report)


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    parser = argparse.ArgumentParser(
        prog="python -m eval",
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("build-items")
    p.add_argument("-c", "--config", help="datagen eval config (its accepted dialogues)")
    p.add_argument(
        "--records",
        action="append",
        help="compiled benchmark JSONL (glob), e.g. 'data/bench/*.jsonl'",
    )
    p.add_argument("--out", required=True)
    p.add_argument("--max-per-dialogue", type=int)
    p.set_defaults(fn=cmd_build_items)
    p = sub.add_parser("predict")
    p.add_argument("--systems", default="eval/configs/systems.yaml")
    p.add_argument("--system", action="append", required=True)
    p.add_argument("--items", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--limit", type=int)
    p.set_defaults(fn=cmd_predict)
    p = sub.add_parser("report")
    p.add_argument("-c", "--config", required=True, help="datagen config (judge, LanguageTool)")
    p.add_argument("--items", required=True)
    p.add_argument("--predictions", required=True)
    p.add_argument("--system", action="append", default=[])
    p.add_argument(
        "--pairwise",
        action="append",
        help=f"SYSTEM:OPPONENT, e.g. student:{REFERENCE} or student:base",
    )
    p.add_argument("--pairwise-sample", type=int, default=300)
    p.add_argument("--bench", action="append", help="DEVICE=path/to/llama-bench.json")
    p.add_argument("--no-languagetool", action="store_true")
    p.add_argument("--note", action="append")
    p.add_argument("--title", default="Tutor model evaluation")
    p.add_argument(
        "--as-shipped", nargs="?", const="snap", choices=["snap", "strict"], help=_AS_SHIPPED
    )
    p.add_argument("--out", required=True)
    p.set_defaults(fn=cmd_report)
    _learner_commands(sub)
    args = parser.parse_args(argv)
    result: int = args.fn(args)
    return result


if __name__ == "__main__":
    raise SystemExit(main())
