from __future__ import annotations

import itertools
import random
from collections import Counter

import pytest

from datagen.config import LearnerConfig
from datagen.learner import PERSONAS_BY_ID, build_jobs, plan_learner_turns, sample_history
from datagen.records import LearnerTurnPlan
from datagen.synthesis import (
    SynthesisError,
    dialogue_json,
    make_brief,
    parse_dialogue,
    prepare,
    synthesize,
)
from datagen.teacher import ScriptedClient
from spec.levels import Level
from spec.models import LearnerProfile
from spec.scenarios import load_library
from spec.taxonomy import tags_for_level
from tests.helpers import make_config, plan_following_turns


def test_jobs_are_deterministic_unique_and_follow_level_mix() -> None:
    config = make_config(targetDialogues=400)
    scenarios = [s for s in load_library().values() if s.split == "train"]
    jobs = build_jobs(config, scenarios)
    assert jobs == build_jobs(config, scenarios)
    assert len({j.id for j in jobs}) == 400
    levels = Counter(j.level for j in jobs)
    assert levels[Level.A1] > levels[Level.B2]
    library = load_library()
    for job in jobs:
        assert job.level in library[job.scenario_id].levels
        assert library[job.scenario_id].split == "train"
        assert job.persona_id in PERSONAS_BY_ID


def _plans(level: Level, seed: int, n: int = 7) -> list[LearnerTurnPlan]:
    scenario = load_library()["weekend-scorso"]
    return plan_learner_turns(
        level=level,
        scenario=scenario,
        profile=LearnerProfile(level=level),
        n_turns=n,
        config=LearnerConfig(),
        rng=random.Random(seed),
    )


@pytest.mark.parametrize("seed", range(40))
def test_plans_follow_prompt_then_recast(seed: int) -> None:
    plans = _plans(Level.A2, seed)
    allowed = {t.id for t in tags_for_level(Level.A2)}
    for previous, current in itertools.pairwise(plans):
        if previous.expected_move == "prompt":
            assert current.kind in {"repair-success", "repair-fail"}
            if current.kind == "repair-fail":
                assert current.error_tags == [previous.target_tag]
                assert current.expected_move == "recast"
            else:
                assert current.expected_move == "none" and not current.error_tags
        else:
            assert current.kind == "fresh"
    for plan in plans:
        assert set(plan.error_tags) <= allowed
        if plan.expected_move != "none":
            assert plan.target_tag in plan.error_tags
    assert not (plans[-1].kind == "fresh" and plans[-1].error_tags)


def test_error_rate_is_roughly_respected() -> None:
    fresh_errors = fresh = 0
    for seed in range(300):
        for plan in _plans(Level.A1, seed, n=6)[:-1]:
            if plan.kind == "fresh":
                fresh += 1
                fresh_errors += bool(plan.error_tags)
    assert 0.45 < fresh_errors / fresh < 0.65


def test_informal_scenarios_never_get_register_errors() -> None:
    scenario = load_library()["presentarsi"]
    config = LearnerConfig(error_rate=dict.fromkeys(Level, 1.0))
    for seed in range(50):
        history = sample_history(Level.A1, scenario, config, random.Random(seed))
        assert all(h.tag != "register" for h in history)


def test_prepare_is_deterministic_and_brief_mentions_plan() -> None:
    config = make_config()
    scenarios = [s for s in load_library().values() if s.split == "train"]
    job = build_jobs(config, scenarios)[0]
    scenario = load_library()[job.scenario_id]
    first = prepare(job, scenario, config)
    assert first == prepare(job, scenario, config)
    context, persona, plan = first
    assert 4 <= len(plan) <= 7
    brief = make_brief(context, persona, plan)
    assert scenario.opening in brief
    assert f"Learner turn {len(plan)}" in brief
    assert "<tutor_instructions>" in brief and '"reply"' in brief


def test_parse_dialogue_validates_structure() -> None:
    scenario = load_library()["weekend-scorso"]
    plans = _plans(Level.A2, 3, n=4)
    turns = plan_following_turns(plans, scenario.opening)
    text = "Here you go:\n```json\n" + dialogue_json(turns) + "\n```"
    parsed = parse_dialogue(text, plans)
    assert parsed.turns == turns and parsed.plan == plans and parsed.notes == []
    with pytest.raises(SynthesisError, match="alternating"):
        parse_dialogue(dialogue_json(turns), _plans(Level.A2, 3, n=6))
    with pytest.raises(SynthesisError, match="no JSON"):
        parse_dialogue("sorry", plans)
    with pytest.raises(SynthesisError, match="schema"):
        parse_dialogue('{"turns": [{"role": "tutor", "output": {"reply": "x"}}]}', [])


def test_synthesize_with_revise_pass() -> None:
    config = make_config(revisePass=True)
    scenarios = [s for s in load_library().values() if s.split == "train"]
    job = build_jobs(config, scenarios)[0]
    scenario = load_library()[job.scenario_id]
    _, _, plan = prepare(job, scenario, config)
    payload = dialogue_json(plan_following_turns(plan, scenario.opening))
    teacher = ScriptedClient([payload, payload])
    record = synthesize(job, scenario, config, teacher)
    assert record.revised and len(teacher.calls) == 2
    assert "<dialogue>" in teacher.calls[1][0]["content"]
    assert record.usage.output_tokens > 0
    assert len(record.learner_turns()) == len(plan)
    assert record.plan == plan
