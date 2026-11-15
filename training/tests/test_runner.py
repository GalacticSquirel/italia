from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path

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
    config = make_config(tmp_path)
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
