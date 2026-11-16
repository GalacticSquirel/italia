"""Resumable pipeline stages over JSONL files in the run's output directory.

    raw.jsonl        generate: one DialogueRecord per finished job
    failed.jsonl     generate: one row per failed attempt (job id, error)
    filtered.jsonl   filter + dedupe: records with `filter` set (passed or not)
    judged.jsonl     judge: passed records with `judge` set

Every stage skips ids already present in its output, so an interrupted run picks up where it
stopped. Jobs that failed `maxAttempts` times are not retried.
"""

from __future__ import annotations

import logging
from collections import Counter
from collections.abc import Callable, Iterable
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path

from datagen.config import DatagenConfig
from datagen.dedupe import find_duplicates
from datagen.filters import filter_dialogue, summarize
from datagen.jsonutil import JsonlAppender, read_jsonl, write_jsonl
from datagen.judge import JudgeParseError, judge_dialogue
from datagen.languagetool import GrammarChecker
from datagen.learner import build_jobs
from datagen.lemmas import BandChecker
from datagen.records import DialogueRecord, FilterResult, Job
from datagen.synthesis import SynthesisError, synthesize
from datagen.teacher import ChatClient
from spec.models import Scenario

log = logging.getLogger("datagen")


@dataclass(frozen=True)
class RunPaths:
    root: Path

    @property
    def raw(self) -> Path:
        return self.root / "raw.jsonl"

    @property
    def failed(self) -> Path:
        return self.root / "failed.jsonl"

    @property
    def filtered(self) -> Path:
        return self.root / "filtered.jsonl"

    @property
    def judged(self) -> Path:
        return self.root / "judged.jsonl"


def select_scenarios(config: DatagenConfig, library: dict[str, Scenario]) -> list[Scenario]:
    chosen = [s for s in library.values() if s.split == config.split]
    if config.scenarios:
        unknown = set(config.scenarios) - set(library)
        if unknown:
            raise ValueError(f"unknown scenarios in config: {sorted(unknown)}")
        chosen = [s for s in chosen if s.id in config.scenarios]
    if not chosen:
        raise ValueError(f"no scenarios in split {config.split!r}")
    return chosen


def pending_jobs(config: DatagenConfig, scenarios: list[Scenario]) -> list[Job]:
    """Jobs not yet generated and not exhausted by failures."""
    paths = RunPaths(config.output_dir)
    done = {row["id"] for row in read_jsonl(paths.raw)}
    failures = Counter(row["id"] for row in read_jsonl(paths.failed))
    return [
        j
        for j in build_jobs(config, scenarios)
        if j.id not in done and failures[j.id] < config.max_attempts
    ]


def run_generate(
    config: DatagenConfig,
    scenarios: list[Scenario],
    teacher: ChatClient,
    *,
    limit: int | None = None,
    progress: Callable[[int, int], None] | None = None,
) -> tuple[int, int]:
    """Generate pending jobs concurrently. Returns (succeeded, failed) for this invocation."""
    paths = RunPaths(config.output_dir)
    jobs = pending_jobs(config, scenarios)
    if limit is not None:
        jobs = jobs[:limit]
    by_id = {s.id: s for s in scenarios}
    ok = failed = 0
    with (
        JsonlAppender(paths.raw) as raw,
        JsonlAppender(paths.failed) as failures,
        ThreadPoolExecutor(max_workers=config.teacher.max_concurrency) as pool,
    ):
        futures = {
            pool.submit(synthesize, job, by_id[job.scenario_id], config, teacher): job
            for job in jobs
        }
        for future in as_completed(futures):
            job = futures[future]
            try:
                record = future.result()
            except (SynthesisError, RuntimeError, ValueError) as err:
                failed += 1
                failures.append({"id": job.id, "error": str(err)[:500]})
                log.warning("job %s failed: %s", job.id, err)
            else:
                ok += 1
                raw.append(record.to_wire())
            if progress:
                progress(ok + failed, len(jobs))
    return ok, failed


def dialogue_text(record: DialogueRecord) -> str:
    return "\n".join(t.text for t in record.turns)


def run_filter(
    config: DatagenConfig,
    *,
    band_checker: BandChecker,
    grammar: GrammarChecker,
    dedupe_threshold: float = 0.8,
) -> dict[str, int]:
    """Filter and dedupe raw dialogues into filtered.jsonl. Returns failure counts by reason."""
    paths = RunPaths(config.output_dir)
    records = [DialogueRecord.model_validate(r) for r in read_jsonl(paths.raw)]
    results: dict[str, FilterResult] = {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {
            pool.submit(
                filter_dialogue,
                r,
                band_checker=band_checker,
                grammar=grammar,
                config=config.filters,
            ): r.id
            for r in records
        }
        for future in as_completed(futures):
            results[futures[future]] = future.result()
    passing = {r.id: dialogue_text(r) for r in records if results[r.id].passed}
    duplicates = find_duplicates(passing, threshold=dedupe_threshold)
    out: list[DialogueRecord] = []
    for record in records:
        result = results[record.id]
        if record.id in duplicates:
            result = FilterResult(
                passed=False, reasons=[*result.reasons, "near-duplicate"], metrics=result.metrics
            )
        out.append(record.model_copy(update={"filter": result}))
    write_jsonl(paths.filtered, (r.to_wire() for r in out))
    counts = summarize([r.filter for r in out if r.filter is not None])
    counts["passed"] = sum(1 for r in out if r.filter is not None and r.filter.passed)
    counts["total"] = len(out)
    return counts


def run_judge(
    config: DatagenConfig,
    judge: ChatClient,
    *,
    limit: int | None = None,
) -> tuple[int, int]:
    """Judge passed dialogues not judged yet. Returns (judged, unparseable)."""
    paths = RunPaths(config.output_dir)
    done = {row["id"] for row in read_jsonl(paths.judged)}
    todo = [
        DialogueRecord.model_validate(r)
        for r in read_jsonl(paths.filtered)
        if r["id"] not in done and r.get("filter", {}).get("passed")
    ]
    if limit is not None:
        todo = todo[:limit]
    ok = bad = 0
    with (
        JsonlAppender(paths.judged) as out,
        ThreadPoolExecutor(max_workers=config.judge_endpoint.max_concurrency) as pool,
    ):
        futures = {
            pool.submit(judge_dialogue, r, judge, max_tokens=config.judge.max_tokens): r
            for r in todo
        }
        for future in as_completed(futures):
            record = futures[future]
            try:
                result, _usage = future.result()
            except (JudgeParseError, RuntimeError) as err:
                bad += 1
                log.warning("judge failed for %s: %s", record.id, err)
                continue
            ok += 1
            out.append(record.model_copy(update={"judge": result}).to_wire())
    return ok, bad


def accepted_records(config: DatagenConfig) -> Iterable[DialogueRecord]:
    """Judged dialogues at or above the judge threshold."""
    for row in read_jsonl(RunPaths(config.output_dir).judged):
        record = DialogueRecord.model_validate(row)
        if record.judge is not None and record.judge.overall >= config.judge.min_overall:
            yield record
