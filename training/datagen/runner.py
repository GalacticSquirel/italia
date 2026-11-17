"""Resumable pipeline stages over JSONL files in the run's output directory.

    raw.jsonl        generate: one DialogueRecord per finished job
    failed.jsonl     generate: one row per failed attempt (job id, error)
    filtered.jsonl   filter + dedupe: records with `filter` set (passed or not)
    judged.jsonl     judge: passed records with `judge` set

Every stage skips ids already present in its output, so an interrupted run picks up where it
stopped. Jobs that failed `maxAttempts` times are not retried.

`refilter` re-runs the filter stage over raw.jsonl after the filters change (no teacher calls),
optionally recovers failed jobs whose last teacher output the current parser now accepts, and
drops judged rows of dialogues that no longer pass.
"""

from __future__ import annotations

import logging
import threading
from collections import Counter
from collections.abc import Callable, Iterable
from concurrent.futures import CancelledError, Future, ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Any, TypeVar

from datagen.config import DatagenConfig
from datagen.dedupe import find_duplicates
from datagen.filters import filter_dialogue, summarize
from datagen.jsonutil import JsonlAppender, read_jsonl, write_jsonl
from datagen.judge import JudgeParseError, judge_dialogue
from datagen.languagetool import GrammarChecker
from datagen.learner import build_jobs
from datagen.lemmas import BandChecker
from datagen.records import DialogueRecord, FilterResult, Job
from datagen.synthesis import SynthesisError, parse_dialogue, prepare, synthesize
from datagen.teacher import ChatClient, Usage
from spec.models import SPEC_VERSION, Scenario

T = TypeVar("T")

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


class _Outage:
    """Stops a teacher-bound stage on the first error that is not about the item itself.

    Leaving a `with ThreadPoolExecutor` block on an exception waits for every queued item to run,
    and their results are lost, so a dead teacher used to burn hours of queue. Instead the queue
    is cancelled, items already in flight are still collected, and the error is re-raised after.

    Cancelling happens in the consumer loop, which may wake up late; meanwhile the workers keep
    taking queued items. `guard` closes that gap: once any worker has seen an outage, items that
    start afterwards are skipped without calling the teacher.
    """

    def __init__(self, item_errors: tuple[type[Exception], ...]) -> None:
        self._item_errors = item_errors
        self._futures: list[Future[object]] = []
        self._down = threading.Event()
        self.error: Exception | None = None

    def guard(self, fn: Callable[..., T]) -> Callable[..., T]:
        def run(*args: object, **kwargs: object) -> T:
            if self._down.is_set():
                raise CancelledError
            try:
                return fn(*args, **kwargs)
            except self._item_errors:
                raise
            except Exception:
                self._down.set()
                raise

        return run

    def track(self, futures: Iterable[Future[Any]]) -> None:
        self._futures = list(futures)

    def record(self, err: Exception) -> None:
        if self.error is None:
            self.error = err
            cancelled = sum(f.cancel() for f in self._futures)
            log.error(
                "teacher unavailable, stopping (%d queued items cancelled): %s", cancelled, err
            )

    def reraise(self) -> None:
        if self.error is not None:
            raise self.error


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
        outage = _Outage((SynthesisError, RuntimeError, ValueError))
        task = outage.guard(synthesize)
        futures = {
            pool.submit(task, job, by_id[job.scenario_id], config, teacher): job for job in jobs
        }
        outage.track(futures)
        for future in as_completed(futures):
            job = futures[future]
            try:
                record = future.result()
            except CancelledError:
                continue
            except (SynthesisError, RuntimeError, ValueError) as err:
                failed += 1
                row: dict[str, object] = {"id": job.id, "error": str(err)[:500]}
                if isinstance(err, SynthesisError) and err.text is not None:
                    row["text"] = err.text  # lets `refilter --reparse-failed` recover it later
                failures.append(row)
                log.warning("job %s failed: %s", job.id, err)
            except Exception as err:  # the teacher, not the job: stop without burning attempts
                outage.record(err)
                continue
            else:
                ok += 1
                raw.append(record.to_wire())
            if progress:
                progress(ok + failed, len(jobs))
    outage.reraise()
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
        outage = _Outage((JudgeParseError, RuntimeError))
        task = outage.guard(judge_dialogue)
        futures = {
            pool.submit(
                task,
                r,
                judge,
                max_tokens=config.judge.max_tokens,
                grammar_check=config.judge.grammar_check,
            ): r
            for r in todo
        }
        outage.track(futures)
        for future in as_completed(futures):
            record = futures[future]
            try:
                result, _usage = future.result()
            except CancelledError:
                continue
            except (JudgeParseError, RuntimeError) as err:
                bad += 1
                log.warning("judge failed for %s: %s", record.id, err)
                continue
            except Exception as err:  # the judge endpoint, not the dialogue
                outage.record(err)
                continue
            ok += 1
            out.append(record.model_copy(update={"judge": result}).to_wire())
    outage.reraise()
    return ok, bad


def accepted_records(config: DatagenConfig) -> Iterable[DialogueRecord]:
    """Judged dialogues that pass the judge's mean threshold and per-criterion floors."""
    for row in read_jsonl(RunPaths(config.output_dir).judged):
        record = DialogueRecord.model_validate(row)
        if record.judge is not None and config.judge.accepts(record.judge.scores):
            yield record


def recover_failed(config: DatagenConfig, scenarios: list[Scenario]) -> int:
    """Reparse failed jobs' last teacher output (kept in failed.jsonl) with the current parser.

    A job that now parses is appended to raw.jsonl (unrevised, usage not re-counted) and so is
    no longer pending. Returns the number recovered. Rows written before failed outputs were
    kept have no text and are skipped.
    """
    paths = RunPaths(config.output_dir)
    done = {row["id"] for row in read_jsonl(paths.raw)}
    texts: dict[str, str] = {}
    for row in read_jsonl(paths.failed):
        if isinstance(row.get("text"), str) and row["id"] not in done:
            texts[row["id"]] = row["text"]  # the latest attempt wins
    if not texts:
        return 0
    by_id = {s.id: s for s in scenarios}
    recovered = 0
    with JsonlAppender(paths.raw) as raw:
        for job in build_jobs(config, scenarios):
            if job.id not in texts:
                continue
            scenario = by_id[job.scenario_id]
            context, persona, plan = prepare(job, scenario, config)
            try:
                parsed = parse_dialogue(texts[job.id], plan, {g.id for g in scenario.goals})
            except SynthesisError:
                continue
            record = DialogueRecord(
                id=job.id,
                spec_version=SPEC_VERSION,
                split=job.split,
                scenario_id=scenario.id,
                level=job.level,
                persona=persona,
                context=context,
                plan=parsed.plan,
                turns=parsed.turns,
                teacher=config.teacher.model,
                usage=Usage(),
                parse_notes=[*parsed.notes, "recovered from failed.jsonl by refilter"],
            )
            raw.append(record.to_wire())
            recovered += 1
    return recovered


def prune_judged(config: DatagenConfig) -> int:
    """Drop judged rows whose dialogue no longer passes the filters. Returns the number dropped."""
    paths = RunPaths(config.output_dir)
    if not paths.judged.exists():
        return 0
    passing = {
        row["id"] for row in read_jsonl(paths.filtered) if row.get("filter", {}).get("passed")
    }
    rows = list(read_jsonl(paths.judged))
    kept = [row for row in rows if row["id"] in passing]
    if len(kept) != len(rows):
        write_jsonl(paths.judged, kept)
    return len(rows) - len(kept)


def run_refilter(
    config: DatagenConfig,
    scenarios: list[Scenario],
    *,
    band_checker: BandChecker,
    grammar: GrammarChecker,
    dedupe_threshold: float = 0.8,
    reparse_failed: bool = False,
) -> dict[str, int]:
    """Re-run the filters over raw.jsonl without generating anything.

    Returns the filter counts plus `passed before` (from the previous filtered.jsonl),
    `recovered` (failed jobs reparsed, with `reparse_failed`) and `judged dropped`. Judged rows
    are kept for dialogues that still pass, so `judge` afterwards only scores the new passes.
    """
    paths = RunPaths(config.output_dir)
    before = sum(1 for row in read_jsonl(paths.filtered) if row.get("filter", {}).get("passed"))
    recovered = recover_failed(config, scenarios) if reparse_failed else 0
    counts = run_filter(
        config, band_checker=band_checker, grammar=grammar, dedupe_threshold=dedupe_threshold
    )
    counts["passed before"] = before
    counts["recovered"] = recovered
    counts["judged dropped"] = prune_judged(config)
    return counts
