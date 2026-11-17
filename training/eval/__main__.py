"""Evaluation CLI. Run from `training/`: `uv run python -m eval <command> ...`.

build-items  held-out items from accepted eval-split dialogues (datagen eval config)
predict      run a system from eval/configs/systems.yaml over the items
report       score systems, optional judge win rates and llama-bench results -> markdown
"""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path

from datagen.__main__ import band_checker, grammar_checker
from datagen.config import load_config
from datagen.jsonutil import read_jsonl, write_jsonl
from datagen.runner import accepted_records
from datagen.teacher import make_client
from eval.items import EvalItem, build_items
from eval.metrics import score_system
from eval.pairwise import WinRate, compare
from eval.predict import load_predictions, load_systems, predict, reference_predictions
from eval.report import BenchRow, parse_llama_bench, render_report, summary_json

REFERENCE = "teacher-reference"


def load_items(path: Path) -> list[EvalItem]:
    return [EvalItem.model_validate(r) for r in read_jsonl(path)]


def cmd_build_items(args: argparse.Namespace) -> int:
    config = load_config(Path(args.config))
    items = build_items(accepted_records(config), max_per_dialogue=args.max_per_dialogue)
    write_jsonl(Path(args.out), (i.to_wire() for i in items))
    print(f"{len(items)} items -> {args.out}")
    return 0


def cmd_predict(args: argparse.Namespace) -> int:
    systems = load_systems(Path(args.systems))
    items = load_items(Path(args.items))
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
    report = render_report(args.title, scores, win_rates, bench, notes=args.note or [])
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(report, encoding="utf-8")
    out.with_suffix(".json").write_text(
        json.dumps(summary_json(scores, win_rates), indent=2), encoding="utf-8"
    )
    print(f"report -> {out}")
    return 0


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    parser = argparse.ArgumentParser(
        prog="python -m eval",
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("build-items")
    p.add_argument("-c", "--config", required=True, help="datagen eval config")
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
    p.add_argument("--out", required=True)
    p.set_defaults(fn=cmd_report)
    args = parser.parse_args(argv)
    result: int = args.fn(args)
    return result


if __name__ == "__main__":
    raise SystemExit(main())
