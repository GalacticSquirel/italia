"""Shared builders for tests."""

from __future__ import annotations

from spec.levels import Level
from spec.models import (
    Annotations,
    LearnerProfile,
    NewWord,
    Prompt,
    Recast,
    ScenarioProgress,
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
    return TutorContext(
        learner=LearnerProfile(level=level), scenario=load_library()[scenario_id]
    )
