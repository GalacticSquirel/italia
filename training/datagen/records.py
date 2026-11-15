"""Records that flow between pipeline stages (all stored as JSONL)."""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from datagen.teacher import Usage
from spec.levels import Level
from spec.models import FeedbackMove, Turn, TutorContext, WireModel

RepairKind = Literal["fresh", "repair-success", "repair-fail"]


class LearnerTurnPlan(WireModel):
    """What the simulated learner does in one turn, and the gold tutor reaction to it."""

    kind: RepairKind
    error_tags: list[str] = Field(default_factory=list)
    target_tag: str | None = None
    expected_move: FeedbackMove


class Persona(WireModel):
    id: str
    l1: Literal["en", "es"]
    gender: Literal["f", "m"]
    description: str


class Job(WireModel):
    """One dialogue to generate. The id is a stable hash, so reruns skip finished jobs."""

    id: str
    split: Literal["train", "eval"]
    scenario_id: str
    level: Level
    persona_id: str
    variant: int
    seed: int


class FilterResult(WireModel):
    passed: bool
    reasons: list[str] = Field(default_factory=list)
    metrics: dict[str, float] = Field(default_factory=dict)


class JudgeScores(WireModel):
    grammaticality: float = Field(ge=1, le=5)
    level_fit: float = Field(ge=1, le=5)
    feedback: float = Field(ge=1, le=5)
    annotation_accuracy: float = Field(ge=1, le=5)
    scenario: float = Field(ge=1, le=5)
    tone: float = Field(ge=1, le=5)
    prompt_withholds: float | None = Field(default=None, ge=1, le=5)
    """Prompts leave the correction to the learner. None for judgements made before this
    criterion existed (and for dialogues without a prompt, where it is not asked)."""

    @property
    def overall(self) -> float:
        values = [
            self.grammaticality,
            self.level_fit,
            self.feedback,
            self.annotation_accuracy,
            self.scenario,
            self.tone,
        ]
        if self.prompt_withholds is not None:
            values.append(self.prompt_withholds)
        return sum(values) / len(values)


class JudgeResult(WireModel):
    scores: JudgeScores
    issues: list[str] = Field(default_factory=list)
    judge: str = ""

    @property
    def overall(self) -> float:
        return self.scores.overall


class DialogueRecord(WireModel):
    id: str
    spec_version: str
    split: Literal["train", "eval"]
    scenario_id: str
    level: Level
    persona: Persona
    context: TutorContext
    plan: list[LearnerTurnPlan]
    turns: list[Turn]
    teacher: str
    usage: Usage = Usage()
    revised: bool = False
    repaired: bool = False
    parse_notes: list[str] = Field(default_factory=list)
    filter: FilterResult | None = None
    judge: JudgeResult | None = None

    def tutor_turns(self) -> list[Turn]:
        return [t for t in self.turns if t.role == "tutor"]

    def learner_turns(self) -> list[Turn]:
        return [t for t in self.turns if t.role == "learner"]
