from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path

import pytest

from datagen.jsonutil import JsonlAppender, extract_json_object, read_jsonl
from datagen.languagetool import NullChecker
from datagen.lemmas import BandChecker, SimplemmaLemmatizer, default_lemma_list
from datagen.runner import (
    RunPaths,
    accepted_records,
    pending_jobs,
    run_filter,
    run_generate,
    run_judge,
    select_scenarios,
)
from datagen.synthesis import dialogue_json, prepare
from datagen.teacher import ScriptedClient
from spec.render import ChatMessage
from spec.scenarios import load_library
from tests.helpers import make_config, plan_following_turns

JUDGE_OK = (
    '{"scores": {"grammaticality": 5, "levelFit": 5, "feedback": 4, '
    '"annotationAccuracy": 5, "scenario": 4, "tone": 5}, "issues": []}'
)


def plan_aware_teacher(config_tmp: Path, fail_every: int = 0) -> ScriptedClient:
    """A fake teacher that answers each brief with a plan-following dialogue."""
    config = make_config(config_tmp)
    library = load_library()
    scenarios = select_scenarios(config, library)
    from datagen.learner import build_jobs

    jobs = build_jobs(config, scenarios)
    briefs: dict[str, str] = {}
    from datagen.synthesis import make_brief

    for job in jobs:
        ctx, persona, plan = prepare(job, library[job.scenario_id], config)
        briefs[make_brief(ctx, persona, plan)] = dialogue_json(
            plan_following_turns(plan, library[job.scenario_id].opening)
        )
    counter = {"n": 0}

    def respond(messages: Sequence[ChatMessage]) -> str:
        counter["n"] += 1
        if fail_every and counter["n"] % fail_every == 0:
            return "I cannot do that."
        return briefs[messages[0]["content"]]

    return ScriptedClient(respond)


def test_generate_is_resumable_and_records_failures(tmp_path: Path) -> None:
    config = make_config(tmp_path, repairAttempts=0)
    scenarios = select_scenarios(config, load_library())
    teacher = plan_aware_teacher(tmp_path, fail_every=4)
    ok, failed = run_generate(config, scenarios, teacher)
    assert ok + failed == 20 and failed == 5
    remaining = pending_jobs(config, scenarios)
    assert len(remaining) == 5
    ok2, failed2 = run_generate(config, scenarios, plan_aware_teacher(tmp_path))
    assert (ok2, failed2) == (5, 0)
    assert pending_jobs(config, scenarios) == []
    ids = [r["id"] for r in read_jsonl(RunPaths(tmp_path).raw)]
    assert len(ids) == len(set(ids)) == 20


def _outage_after(n_ok: int, answer: ScriptedClient) -> tuple[ScriptedClient, dict[str, int]]:
    """A teacher that answers `n_ok` calls and then is unreachable (server down or restarting)."""
    from datagen.teacher import TeacherUnavailableError

    calls = {"n": 0}

    def respond(messages: Sequence[ChatMessage]) -> str:
        calls["n"] += 1
        if calls["n"] > n_ok:
            raise TeacherUnavailableError("teacher: giving up after 4 tries")
        return answer._responses(messages)  # type: ignore[operator]

    return ScriptedClient(respond), calls


def test_teacher_outage_stops_generate_and_keeps_finished_work(tmp_path: Path) -> None:
    """Before: the outage was either recorded as a failed attempt for every remaining job, or
    escaped the loop, after which the executor still ran (and discarded) the whole queue."""
    import pytest

    from datagen.teacher import TeacherUnavailableError

    config = make_config(tmp_path, repairAttempts=0, targetDialogues=200)
    scenarios = select_scenarios(config, load_library())
    teacher, calls = _outage_after(4, plan_aware_teacher(tmp_path))
    with pytest.raises(TeacherUnavailableError):
        run_generate(config, scenarios, teacher)
    assert calls["n"] <= 20  # 200 jobs queued: stops within a few calls of the outage
    assert len(list(read_jsonl(RunPaths(tmp_path).raw))) == 4  # finished work is kept
    assert list(read_jsonl(RunPaths(tmp_path).failed)) == []  # no attempts burned
    assert len(pending_jobs(config, scenarios)) == 196


def test_teacher_outage_stops_judge(tmp_path: Path) -> None:
    import pytest

    from datagen.jsonutil import write_jsonl
    from datagen.teacher import TeacherUnavailableError

    config = make_config(tmp_path, repairAttempts=0)
    scenarios = select_scenarios(config, load_library())
    run_generate(config, scenarios, plan_aware_teacher(tmp_path), limit=10)
    rows = []
    for copy in range(6):  # 60 dialogues queued for the judge
        for row in read_jsonl(RunPaths(tmp_path).raw):
            row["id"] = str(row["id"]) + f"-{copy}"
            row["filter"] = {"passed": True, "reasons": [], "metrics": {}}
            rows.append(row)
    write_jsonl(RunPaths(tmp_path).filtered, rows)
    verdict = ScriptedClient(lambda m: JUDGE_OK)
    judge, calls = _outage_after(3, verdict)
    with pytest.raises(TeacherUnavailableError):
        run_judge(config, judge)
    assert calls["n"] <= 15  # not all 60
    assert len(list(read_jsonl(RunPaths(tmp_path).judged))) == 3


def test_jobs_exhausted_after_max_attempts(tmp_path: Path) -> None:
    config = make_config(tmp_path, maxAttempts=2)
    scenarios = select_scenarios(config, load_library())
    always_fail = ScriptedClient(["nope"])
    run_generate(config, scenarios, always_fail)
    run_generate(config, scenarios, always_fail)
    assert pending_jobs(config, scenarios) == []


def test_filter_and_judge_stages(tmp_path: Path) -> None:
    config = make_config(tmp_path)
    scenarios = select_scenarios(config, load_library())
    run_generate(config, scenarios, plan_aware_teacher(tmp_path))
    counts = run_filter(
        config,
        band_checker=BandChecker(default_lemma_list(), SimplemmaLemmatizer()),
        grammar=NullChecker(),
    )
    assert counts["total"] == 20
    # Plan-following dialogues share most lines, so dedupe keeps only a few.
    assert 1 <= counts["passed"] < 20
    assert counts.get("near-duplicate", 0) == 20 - counts["passed"]
    judged, bad = run_judge(config, ScriptedClient([JUDGE_OK]))
    assert (judged, bad) == (counts["passed"], 0)
    assert run_judge(config, ScriptedClient([JUDGE_OK])) == (0, 0)  # resumable
    assert len(list(accepted_records(config))) == counts["passed"]


def test_jsonl_helpers(tmp_path: Path) -> None:
    path = tmp_path / "x.jsonl"
    with JsonlAppender(path) as out:
        out.append({"id": 1})
    with path.open("a") as fh:
        fh.write('{"id": 2, "trunc')  # interrupted write
    assert list(read_jsonl(path)) == [{"id": 1}]
    assert extract_json_object('x {"a": "}"} y {"b": 1}') == {"a": "}"}


def test_outage_stops_workers_before_the_consumer_cancels(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The consumer loop cancels the queue only when it next wakes up; before `guard`, idle
    workers kept calling the dead endpoint for queued items in that gap (seen as 21 calls on
    CI for a queue of 60). A slow consumer makes the gap as wide as possible."""
    import time

    from datagen import runner
    from datagen.jsonutil import write_jsonl
    from datagen.teacher import TeacherUnavailableError

    record = runner._Outage.record

    def late_record(self: runner._Outage, err: Exception) -> None:
        time.sleep(0.3)
        record(self, err)

    monkeypatch.setattr(runner._Outage, "record", late_record)
    config = make_config(tmp_path, repairAttempts=0)
    scenarios = select_scenarios(config, load_library())
    run_generate(config, scenarios, plan_aware_teacher(tmp_path), limit=10)
    rows = []
    for copy in range(6):
        for row in read_jsonl(RunPaths(tmp_path).raw):
            row["id"] = str(row["id"]) + f"-{copy}"
            row["filter"] = {"passed": True, "reasons": [], "metrics": {}}
            rows.append(row)
    write_jsonl(RunPaths(tmp_path).filtered, rows)
    judge, calls = _outage_after(3, ScriptedClient(lambda m: JUDGE_OK))
    with pytest.raises(TeacherUnavailableError):
        run_judge(config, judge)
    assert calls["n"] <= 3 + config.judge_endpoint.max_concurrency
