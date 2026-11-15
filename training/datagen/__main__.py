"""Data generation CLI. Run from `training/`: `uv run python -m datagen <command> -c <config>`.

Commands, in pipeline order:

    estimate           print expected token usage and cost for the pending jobs
    generate           write dialogues with the teacher (prints the estimate and asks first)
    filter             automatic filters + dedupe -> filtered.jsonl
    judge              judge-model scores for dialogues that passed -> judged.jsonl
    build-sft          SFT train/val JSONL from accepted dialogues
    build-dpo-prompts  dialogue prefixes for the student to sample on (after SFT)
    judge-candidates   score sampled student turns (from `python -m train.sample`)
    build-dpo          preference pairs from scored candidates
    stats              counts per stage
    lemmas             extract the seed lemma list from a content seed JSON
"""

from __future__ import annotations

import argparse
import hashlib
import logging
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

from datagen.builders import (
    Candidate,
    CandidateSet,
    DpoPrompt,
    build_dpo_prompts,
    build_preference_pairs,
    build_sft,
)
from datagen.config import DatagenConfig, load_config
from datagen.cost import estimate_cost
from datagen.jsonutil import read_jsonl, write_jsonl
from datagen.judge import JudgeParseError, judge_candidates
from datagen.languagetool import GrammarChecker, LanguageToolClient, NullChecker
from datagen.lemmas import (
    DEFAULT_LEMMA_FILE,
    BandChecker,
    LemmaList,
    SimplemmaLemmatizer,
    extract_seed_lemmas,
)
from datagen.runner import (
    RunPaths,
    accepted_records,
    pending_jobs,
    run_filter,
    run_generate,
    run_judge,
    select_scenarios,
)
from datagen.synthesis import make_brief, prepare
from datagen.teacher import make_client
from spec.scenarios import load_library


def _config(args: argparse.Namespace) -> DatagenConfig:
    return load_config(Path(args.config))


def band_checker(config: DatagenConfig) -> BandChecker:
    return BandChecker(
        LemmaList.load(config.lemma_file or DEFAULT_LEMMA_FILE), SimplemmaLemmatizer()
    )


def grammar_checker(config: DatagenConfig, disabled: bool = False) -> GrammarChecker:
    if disabled or not config.language_tool.enabled:
        return NullChecker()
    return LanguageToolClient(config.language_tool.url)


def cmd_estimate(args: argparse.Namespace) -> int:
    config = _config(args)
    scenarios = select_scenarios(config, load_library())
    jobs = pending_jobs(config, scenarios)
    estimate = estimate_cost(config, jobs, {s.id: s for s in scenarios})
    print(f"Run {config.name!r}: teacher {config.teacher.protocol}:{config.teacher.model}")
    print(estimate.table())
    pricing = config.teacher.pricing
    if pricing.input_per_mtok == 0 and pricing.output_per_mtok == 0:
        print("warning: teacher pricing is 0; set teacher.pricing in the config", file=sys.stderr)
    return 0


def cmd_generate(args: argparse.Namespace) -> int:
    config = _config(args)
    scenarios = select_scenarios(config, load_library())
    jobs = pending_jobs(config, scenarios)
    if args.limit is not None:
        jobs = jobs[: args.limit]
    if not jobs:
        print("nothing to do: all jobs are generated")
        return 0
    estimate = estimate_cost(config, jobs, {s.id: s for s in scenarios})
    print(estimate.table())
    if args.dry_run:
        by_id = {s.id: s for s in scenarios}
        context, persona, plan = prepare(jobs[0], by_id[jobs[0].scenario_id], config)
        print("\n--- first brief ---\n" + make_brief(context, persona, plan))
        return 0
    if not args.yes:
        answer = input(f"Spend about ${estimate.total_cost:,.2f}? Type 'yes' to continue: ")
        if answer.strip().lower() != "yes":
            print("aborted")
            return 1
    teacher = make_client(config.teacher)

    def progress(done: int, total: int) -> None:
        if done % 50 == 0 or done == total:
            print(f"  {done}/{total}", flush=True)

    ok, failed = run_generate(config, scenarios, teacher, limit=args.limit, progress=progress)
    print(f"generated {ok}, failed {failed} -> {RunPaths(config.output_dir).raw}")
    return 0


def cmd_filter(args: argparse.Namespace) -> int:
    config = _config(args)
    counts = run_filter(
        config,
        band_checker=band_checker(config),
        grammar=grammar_checker(config, args.no_languagetool),
        dedupe_threshold=args.dedupe_threshold,
    )
    for key, value in counts.items():
        print(f"{key:>40}: {value}")
    return 0


def cmd_judge(args: argparse.Namespace) -> int:
    config = _config(args)
    ok, bad = run_judge(config, make_client(config.judge_endpoint), limit=args.limit)
    print(f"judged {ok}, unparseable {bad}")
    return 0


def cmd_build_sft(args: argparse.Namespace) -> int:
    config = _config(args)
    train, val = build_sft(
        accepted_records(config),
        val_fraction=args.val_fraction,
        seed=config.seed,
        max_dialogues=args.max_dialogues,
    )
    out = Path(args.out)
    write_jsonl(out / "sft.train.jsonl", train)
    write_jsonl(out / "sft.val.jsonl", val)
    print(f"SFT: {len(train)} train, {len(val)} val -> {out}")
    return 0


def cmd_build_dpo_prompts(args: argparse.Namespace) -> int:
    config = _config(args)
    prompts = build_dpo_prompts(
        accepted_records(config), per_dialogue=args.per_dialogue, seed=config.seed
    )
    if args.max_prompts:
        prompts = prompts[: args.max_prompts]
    write_jsonl(Path(args.out), (p.to_wire() for p in prompts))
    print(f"{len(prompts)} DPO prompts -> {args.out}")
    return 0


def cmd_judge_candidates(args: argparse.Namespace) -> int:
    """Input rows: {"prompt": DpoPrompt, "samples": [str, ...]} from `python -m train.sample`."""
    config = _config(args)
    client = make_client(config.judge_endpoint)
    rows = list(read_jsonl(Path(args.candidates)))

    def score(row: dict[str, Any]) -> CandidateSet | None:
        prompt = DpoPrompt.model_validate(row["prompt"])
        samples = [str(s) for s in row["samples"]]
        texts = [*samples, prompt.reference] if args.include_reference else samples
        sources = ["student"] * len(samples) + (["reference"] if args.include_reference else [])
        try:
            scores, _usage = judge_candidates(
                prompt.messages,
                texts,
                level=prompt.level,
                client=client,
                max_tokens=config.judge.max_tokens,
                seed=int(hashlib.sha256(prompt.id.encode()).hexdigest()[:8], 16),
            )
        except (JudgeParseError, RuntimeError) as err:
            logging.warning("candidate judging failed for %s: %s", prompt.id, err)
            return None
        return CandidateSet(
            prompt=prompt,
            candidates=[
                Candidate(text=t, source=s, scores=sc)
                for t, s, sc in zip(texts, sources, scores, strict=True)
            ],
        )

    with ThreadPoolExecutor(max_workers=config.judge_endpoint.max_concurrency) as pool:
        results = [r for r in pool.map(score, rows) if r is not None]
    write_jsonl(Path(args.out), (r.to_wire() for r in results))
    print(f"scored {len(results)} of {len(rows)} prompts -> {args.out}")
    return 0


def cmd_build_dpo(args: argparse.Namespace) -> int:
    sets = [CandidateSet.model_validate(r) for r in read_jsonl(Path(args.scored))]
    pairs = build_preference_pairs(
        sets,
        min_margin=args.min_margin,
        min_chosen_score=args.min_chosen,
        max_pairs_per_prompt=args.max_pairs,
    )
    write_jsonl(Path(args.out), pairs)
    print(f"{len(pairs)} preference pairs from {len(sets)} prompts -> {args.out}")
    return 0


def cmd_stats(args: argparse.Namespace) -> int:
    config = _config(args)
    paths = RunPaths(config.output_dir)
    raw = sum(1 for _ in read_jsonl(paths.raw))
    failed = len({r["id"] for r in read_jsonl(paths.failed)})
    filtered = list(read_jsonl(paths.filtered))
    passed = sum(1 for r in filtered if r.get("filter", {}).get("passed"))
    judged = sum(1 for _ in read_jsonl(paths.judged))
    accepted = sum(1 for _ in accepted_records(config))
    print(
        f"raw {raw}, failed jobs {failed}, passed filters {passed}/{len(filtered)}, "
        f"judged {judged}, accepted {accepted}"
    )
    return 0


def cmd_lemmas(args: argparse.Namespace) -> int:
    n = extract_seed_lemmas(Path(args.seed), Path(args.out))
    print(f"wrote {n} lemmas -> {args.out}")
    return 0


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    parser = argparse.ArgumentParser(
        prog="python -m datagen",
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    def with_config(name: str, help_text: str) -> argparse.ArgumentParser:
        p = sub.add_parser(name, help=help_text)
        p.add_argument("-c", "--config", required=True)
        return p

    with_config("estimate", "print expected tokens and cost").set_defaults(fn=cmd_estimate)
    p = with_config("generate", "generate dialogues with the teacher")
    p.add_argument("--limit", type=int)
    p.add_argument("--yes", action="store_true", help="do not ask for confirmation")
    p.add_argument("--dry-run", action="store_true", help="print the estimate and one brief")
    p.set_defaults(fn=cmd_generate)
    p = with_config("filter", "automatic filters and dedupe")
    p.add_argument("--no-languagetool", action="store_true")
    p.add_argument("--dedupe-threshold", type=float, default=0.8)
    p.set_defaults(fn=cmd_filter)
    p = with_config("judge", "judge-model scores")
    p.add_argument("--limit", type=int)
    p.set_defaults(fn=cmd_judge)
    p = with_config("build-sft", "SFT datasets")
    p.add_argument("--out", required=True)
    p.add_argument("--val-fraction", type=float, default=0.02)
    p.add_argument("--max-dialogues", type=int)
    p.set_defaults(fn=cmd_build_sft)
    p = with_config("build-dpo-prompts", "DPO prompts")
    p.add_argument("--out", required=True)
    p.add_argument("--per-dialogue", type=int, default=2)
    p.add_argument("--max-prompts", type=int)
    p.set_defaults(fn=cmd_build_dpo_prompts)
    p = with_config("judge-candidates", "score sampled candidates")
    p.add_argument("--candidates", required=True)
    p.add_argument("--out", required=True)
    p.add_argument(
        "--include-reference",
        action="store_true",
        help="also score the teacher's turn as a candidate",
    )
    p.set_defaults(fn=cmd_judge_candidates)
    p = sub.add_parser("build-dpo", help="preference pairs")
    p.add_argument("--scored", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--min-margin", type=float, default=0.5)
    p.add_argument("--min-chosen", type=float, default=4.0)
    p.add_argument("--max-pairs", type=int, default=2)
    p.set_defaults(fn=cmd_build_dpo)
    with_config("stats", "counts per stage").set_defaults(fn=cmd_stats)
    p = sub.add_parser("lemmas", help="extract the seed lemma list")
    p.add_argument("--seed", required=True, help="path to packages/content/seed/seed.v1.json")
    p.add_argument("--out", default=str(DEFAULT_LEMMA_FILE))
    p.set_defaults(fn=cmd_lemmas)

    args = parser.parse_args(argv)
    result: int = args.fn(args)
    return result


if __name__ == "__main__":
    raise SystemExit(main())
