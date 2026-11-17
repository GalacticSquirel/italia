"""Shared builders for tests."""

from __future__ import annotations

from pathlib import Path

from datagen.config import DatagenConfig
from datagen.records import DialogueRecord, Job, LearnerTurnPlan
from datagen.synthesis import dialogue_json, prepare
from spec.levels import Level
from spec.models import (
    Annotations,
    LearnerProfile,
    NewWord,
    Prompt,
    Recast,
    ScenarioProgress,
    Turn,
    TutorContext,
    TutorOutput,
)
from spec.scenarios import load_library


def output(
    reply: str,
    *,
    prompt: tuple[str, list[str]] | None = None,
    recast: tuple[str, str, list[str]] | None = None,
    new_words: list[tuple[str, str]] | None = None,
    goals: list[str] | None = None,
    done: bool = False,
) -> TutorOutput:
    return TutorOutput(
        reply=reply,
        annotations=Annotations(
            prompt=Prompt(learner_text=prompt[0], error_tags=prompt[1]) if prompt else None,
            recast=(
                Recast(learner_text=recast[0], corrected_text=recast[1], error_tags=recast[2])
                if recast
                else None
            ),
            new_words=[NewWord(lemma=lemma, gloss_en=g) for lemma, g in (new_words or [])],
            scenario_progress=ScenarioProgress(goals_completed=goals or [], done=done),
        ),
    )


def context(scenario_id: str = "bar-colazione", level: Level = Level.A1) -> TutorContext:
    return TutorContext(learner=LearnerProfile(level=level), scenario=load_library()[scenario_id])


# ---------------------------------------------------------------------------------------------
# Synthetic dialogues that follow a plan exactly (stand-in for the teacher model)
# ---------------------------------------------------------------------------------------------


def plan_following_turns(plan: list[LearnerTurnPlan], opening: str) -> list[Turn]:
    """Tutor and learner turns that obey `plan`, using a small in-band vocabulary."""
    turns = [Turn.tutor(output(opening))]
    goals: list[str] = []
    for index, step in enumerate(plan):
        last = index == len(plan) - 1
        if step.error_tags:
            turns.append(Turn.learner("Ieri io ho andato al bar con un amico."))
        else:
            turns.append(Turn.learner("Ieri sono andato al bar con un amico."))
        tag = step.target_tag or "auxiliary-choice"
        if step.expected_move == "prompt":
            out = output("Ho andato? Sei sicuro?", prompt=("ho andato", [tag]), goals=goals)
        elif step.expected_move == "recast":
            out = output(
                "Ah, sei andato al bar! E poi?",
                recast=("ho andato", "sei andato", [tag]),
                goals=goals,
            )
        else:
            out = output(
                "Bene! E poi?" if not last else "Grazie, a presto!", goals=goals, done=last
            )
        turns.append(Turn.tutor(out))
    return turns


def dialogue_payload(turns: list[Turn]) -> str:
    return dialogue_json(turns)


def make_record(
    scenario_id: str = "weekend-scorso",
    level: Level = Level.A2,
    seed: int = 1,
) -> DialogueRecord:
    config = make_config()
    scenario = load_library()[scenario_id]
    job = Job(
        id=f"job-{scenario_id}-{seed}",
        split=scenario.split,
        scenario_id=scenario_id,
        level=level,
        persona_id="en-m-retired",
        variant=0,
        seed=seed,
    )
    ctx, persona, plan = prepare(job, scenario, config)
    return DialogueRecord(
        id=job.id,
        spec_version="1.0.0",
        split=job.split,
        scenario_id=scenario_id,
        level=level,
        persona=persona,
        context=ctx,
        plan=plan,
        turns=plan_following_turns(plan, scenario.opening),
        teacher="test",
    )


def make_config(tmp: Path | None = None, **overrides: object) -> DatagenConfig:
    data: dict[str, object] = {
        "name": "test",
        "outputDir": str(tmp or Path("/nonexistent")),
        "targetDialogues": 20,
        "teacher": {
            "protocol": "openai",
            "baseUrl": "http://teacher.invalid",
            "model": "t",
            "pricing": {"inputPerMtok": 3, "outputPerMtok": 15},
            "maxConcurrency": 2,
        },
        "revisePass": False,
        "languageTool": {"enabled": False},
        # scripted judges answer only the rubric; tests/test_grammar_check.py covers the check
        "judge": {"grammarCheck": False, "feedbackCheck": False},
    }
    data.update(overrides)
    return DatagenConfig.model_validate(data)
