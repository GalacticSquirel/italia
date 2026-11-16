"""Simulated learners: personas, error injection plans, and the job grid.

The plan is decided here, deterministically from the job seed, before the teacher writes a word.
It says which errors each learner turn contains and what the tutor must do about them (via
`spec.policy`). That makes the injected errors the gold labels for recast and error-tag scoring,
and lets the filters check that the teacher followed the policy.
"""

from __future__ import annotations

import hashlib
import random
from collections.abc import Sequence

from datagen.config import DatagenConfig, LearnerConfig
from datagen.records import Job, LearnerTurnPlan, Persona
from spec.levels import Level
from spec.models import ErrorHistoryItem, LearnerProfile, Scenario
from spec.policy import expected_move, pick_target_error
from spec.taxonomy import error_tags, grammar_points, tags_for_level

PERSONAS: tuple[Persona, ...] = (
    Persona(
        id="en-f-student",
        l1="en",
        gender="f",
        description="a university student from Leeds; quick, informal, sometimes drops words",
    ),
    Persona(
        id="en-m-retired",
        l1="en",
        gender="m",
        description="a retired engineer from Ohio; careful, slow, tries full sentences",
    ),
    Persona(
        id="en-f-professional",
        l1="en",
        gender="f",
        description="a marketing manager from Sydney who moved to Milan; confident, makes calques",
    ),
    Persona(
        id="en-m-traveller",
        l1="en",
        gender="m",
        description="a backpacker from Dublin; chatty, mixes in English words when stuck",
    ),
    Persona(
        id="es-f-erasmus",
        l1="es",
        gender="f",
        description="an Erasmus student from Seville; fluent-sounding but uses Spanish forms",
    ),
    Persona(
        id="es-m-worker",
        l1="es",
        gender="m",
        description="a chef from Buenos Aires working in Bologna; practical, short answers",
    ),
    Persona(
        id="en-m-heritage",
        l1="en",
        gender="m",
        description="a heritage speaker from Toronto with Italian grandparents; good listening, "
        "shaky grammar",
    ),
    Persona(
        id="es-f-teacher",
        l1="es",
        gender="f",
        description="a schoolteacher from Valencia; precise, slightly formal",
    ),
)
PERSONAS_BY_ID = {p.id: p for p in PERSONAS}


def stable_id(*parts: object) -> str:
    return hashlib.sha256("|".join(str(p) for p in parts).encode()).hexdigest()[:16]


def build_jobs(config: DatagenConfig, scenarios: Sequence[Scenario]) -> list[Job]:
    """The deterministic job list: levels by `levelMix`, scenarios and personas round-robin."""
    rng = random.Random(config.seed)
    by_level: dict[Level, list[Scenario]] = {
        level: [s for s in scenarios if level in s.levels] for level in Level
    }
    levels = [lv for lv, w in config.learner.level_mix.items() if w > 0 and by_level[lv]]
    if not levels:
        raise ValueError("no scenarios match the configured levels")
    weights = [config.learner.level_mix[lv] for lv in levels]
    counters: dict[Level, int] = dict.fromkeys(Level, 0)
    jobs: list[Job] = []
    for index in range(config.target_dialogues):
        level = rng.choices(levels, weights)[0]
        pool = by_level[level]
        n = counters[level]
        counters[level] += 1
        scenario = pool[n % len(pool)]
        persona = PERSONAS[(n // len(pool) + n) % len(PERSONAS)]
        variant = n // len(pool)
        job_id = stable_id(config.split, scenario.id, level, persona.id, variant, index)
        jobs.append(
            Job(
                id=job_id,
                split=config.split,
                scenario_id=scenario.id,
                level=level,
                persona_id=persona.id,
                variant=variant,
                seed=int(job_id, 16) % (2**31),
            )
        )
    return jobs


def _tag_weights(
    level: Level, scenario: Scenario, history: Sequence[str], config: LearnerConfig
) -> dict[str, float]:
    points = grammar_points()
    focus = set(scenario.grammar_focus)
    weights: dict[str, float] = {}
    for tag in tags_for_level(level):
        weight = config.tag_weights.get(tag.id, 1.0)
        if focus.intersection(tag.grammar_points):
            weight *= config.focus_boost
        if tag.id in history:
            weight *= config.history_boost
        # Errors on structures far below the learner's level are rarer.
        if tag.grammar_points:
            gap = level.rank - min(points[g].cefr.rank for g in tag.grammar_points)
            weight *= 1.0 / (1 + 0.5 * max(gap - 1, 0))
        if tag.id == "register" and scenario.formality == "informal":
            weight = 0.0
        if weight > 0:
            weights[tag.id] = weight
    return weights


def sample_history(
    level: Level, scenario: Scenario, config: LearnerConfig, rng: random.Random
) -> list[ErrorHistoryItem]:
    """A plausible record of the learner's recurring errors from earlier sessions."""
    k = rng.randint(0, config.max_history_items)
    if k == 0:
        return []
    weights = _tag_weights(level, scenario, (), config)
    tags = list(weights)
    chosen: list[str] = []
    while len(chosen) < min(k, len(tags)):
        tag = rng.choices(tags, [weights[t] for t in tags])[0]
        if tag not in chosen:
            chosen.append(tag)
    taxonomy = error_tags()
    return [
        ErrorHistoryItem(tag=t, count=rng.randint(2, 9), last_example=taxonomy[t].example_wrong)
        for t in chosen
    ]


def build_profile(
    level: Level, scenario: Scenario, config: LearnerConfig, rng: random.Random
) -> LearnerProfile:
    return LearnerProfile(level=level, error_history=sample_history(level, scenario, config, rng))


def plan_learner_turns(
    *,
    level: Level,
    scenario: Scenario,
    profile: LearnerProfile,
    n_turns: int,
    config: LearnerConfig,
    rng: random.Random,
) -> list[LearnerTurnPlan]:
    """Errors per learner turn and the gold tutor move after each one.

    The last learner turn gets no fresh error, so the dialogue never ends on an open prompt.
    """
    history = [h.tag for h in profile.error_history]
    weights = _tag_weights(level, scenario, history, config)
    tags = list(weights)
    plans: list[LearnerTurnPlan] = []
    prompted: list[str] = []
    for index in range(n_turns):
        last = index == n_turns - 1
        if prompted:
            if rng.random() < config.self_correct_rate[level]:
                plan = LearnerTurnPlan(kind="repair-success", expected_move="none")
            else:
                plan = LearnerTurnPlan(
                    kind="repair-fail",
                    error_tags=list(prompted),
                    target_tag=prompted[0],
                    expected_move=expected_move(prompted, prompted),
                )
        elif tags and not last and rng.random() < config.error_rate[level]:
            errors = [rng.choices(tags, [weights[t] for t in tags])[0]]
            if rng.random() < config.second_error_rate:
                second = rng.choices(tags, [weights[t] for t in tags])[0]
                if second not in errors:
                    errors.append(second)
            target = pick_target_error(errors, scenario, history)
            target_list = [target] if target else []
            plan = LearnerTurnPlan(
                kind="fresh",
                error_tags=errors,
                target_tag=target,
                expected_move=expected_move(target_list),
            )
        else:
            plan = LearnerTurnPlan(kind="fresh", expected_move="none")
        plans.append(plan)
        prompted = [plan.target_tag] if plan.expected_move == "prompt" and plan.target_tag else []
    return plans
