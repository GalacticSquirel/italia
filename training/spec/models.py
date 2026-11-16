"""Typed model I/O for the tutor (spec version in `SPEC_VERSION`).

Wire names are camelCase (the app reads them in TypeScript); Python attributes are snake_case.
The JSON Schema in `spec/schema/` is generated from these models (`python -m spec export-schema`)
and a test keeps the two in sync.

Output key order is part of the contract: `reply` comes first so the app can stream it to
text-to-speech while the annotations are still being decoded.
"""

from __future__ import annotations

import json
from typing import Annotated, Final, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator
from pydantic.alias_generators import to_camel

from spec.levels import Level

SPEC_VERSION: Final = "1.1.0"
"""Bump the major version for any change to the output format or the system prompt contract.

1.1.0 added the C1 and C2 levels (new enum values; output format and prompt unchanged). Contexts
still accept 1.0.0 so records generated before it keep loading.
"""

START_MESSAGE = "[inizio]"
"""The first user message of every conversation: tells the tutor to open the scenario."""

NonEmpty = Annotated[str, StringConstraints(min_length=1, strip_whitespace=True)]
TagId = Annotated[str, StringConstraints(pattern=r"^[a-z][a-z0-9-]*$")]
Slug = Annotated[str, StringConstraints(pattern=r"^[a-z0-9][a-z0-9-]*$")]


class WireModel(BaseModel):
    """Base for wire models: camelCase aliases, no unknown keys, immutable."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
        frozen=True,
    )

    def to_wire(self) -> dict[str, object]:
        return self.model_dump(by_alias=True, mode="json")


# ---------------------------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------------------------


class Prompt(WireModel):
    """A prompt: the reply pushes the learner to self-correct (first step of the error loop)."""

    learner_text: NonEmpty = Field(description="The erroneous span, copied from the learner turn.")
    error_tags: list[TagId] = Field(min_length=1, max_length=2)


class Recast(WireModel):
    """A recast: the reply gives back the corrected form (second step, or meaning-critical)."""

    learner_text: NonEmpty = Field(description="The erroneous span, copied from the learner turn.")
    corrected_text: NonEmpty = Field(description="The same span, corrected.")
    error_tags: list[TagId] = Field(min_length=1, max_length=2)

    @model_validator(mode="after")
    def _changed(self) -> Recast:
        if _norm(self.learner_text) == _norm(self.corrected_text):
            raise ValueError("correctedText must differ from learnerText")
        return self


class NewWord(WireModel):
    """A lemma above the learner's ceiling that the reply introduces on purpose."""

    lemma: NonEmpty
    gloss_en: NonEmpty


class ScenarioProgress(WireModel):
    goals_completed: list[Slug] = Field(
        description="Ids of all scenario goals completed so far (cumulative)."
    )
    done: bool = Field(description="True when the scenario has reached its end.")


class Annotations(WireModel):
    prompt: Prompt | None
    recast: Recast | None
    new_words: list[NewWord] = Field(max_length=3)
    scenario_progress: ScenarioProgress

    @model_validator(mode="after")
    def _one_feedback_move(self) -> Annotations:
        if self.prompt is not None and self.recast is not None:
            raise ValueError("a turn carries a prompt or a recast, not both")
        return self

    @property
    def move(self) -> FeedbackMove:
        if self.recast is not None:
            return "recast"
        if self.prompt is not None:
            return "prompt"
        return "none"

    @property
    def error_tags(self) -> list[str]:
        if self.recast is not None:
            return list(self.recast.error_tags)
        if self.prompt is not None:
            return list(self.prompt.error_tags)
        return []


class TutorOutput(WireModel):
    """One tutor turn: the Italian reply plus structured annotations."""

    reply: NonEmpty = Field(max_length=600)
    annotations: Annotations

    def to_json(self) -> str:
        """Canonical serialisation used for training targets (compact, reply first)."""
        return json.dumps(self.to_wire(), ensure_ascii=False, separators=(",", ":"))


FeedbackMove = Literal["none", "prompt", "recast"]


# ---------------------------------------------------------------------------------------------
# Input (rendered into the system prompt)
# ---------------------------------------------------------------------------------------------


class ScenarioGoal(WireModel):
    id: Slug
    description: NonEmpty


class Scenario(WireModel):
    """An everyday task the learner role-plays with the tutor (see `scenarios/*.yaml`)."""

    id: Slug
    title: NonEmpty
    title_en: NonEmpty
    levels: list[Level] = Field(min_length=1)
    setting: NonEmpty
    tutor_role: NonEmpty
    learner_role: NonEmpty
    formality: Literal["formal", "informal"]
    goals: list[ScenarioGoal] = Field(min_length=2, max_length=6)
    key_vocab: list[NonEmpty] = Field(min_length=5)
    grammar_focus: list[Slug] = Field(default_factory=list)
    opening: NonEmpty
    tags: list[Slug] = Field(default_factory=list)
    split: Literal["train", "eval"] = "train"

    @model_validator(mode="after")
    def _unique_goals(self) -> Scenario:
        ids = [g.id for g in self.goals]
        if len(ids) != len(set(ids)):
            raise ValueError(f"duplicate goal ids in scenario {self.id}")
        return self


class ErrorHistoryItem(WireModel):
    tag: TagId
    count: int = Field(ge=1)
    last_example: str | None = None


class LearnerProfile(WireModel):
    level: Level
    lemma_ceiling: int | None = Field(
        default=None, ge=1, description="Known-lemma frequency ceiling; defaults to the band's."
    )
    known_grammar: list[Slug] = Field(
        default_factory=list,
        description="Grammar points the learner has unlocked; empty means all up to the level.",
    )
    error_history: list[ErrorHistoryItem] = Field(default_factory=list, max_length=5)


class TutorContext(WireModel):
    """Everything the system prompt is rendered from."""

    spec_version: Literal["1.0.0", "1.1.0"] = SPEC_VERSION
    learner: LearnerProfile
    scenario: Scenario


class Turn(WireModel):
    """One dialogue turn. Tutor turns carry their structured output."""

    role: Literal["tutor", "learner"]
    text: NonEmpty
    output: TutorOutput | None = None

    @model_validator(mode="after")
    def _tutor_has_output(self) -> Turn:
        if self.role == "tutor" and self.output is None:
            raise ValueError("tutor turns need an output")
        if self.role == "learner" and self.output is not None:
            raise ValueError("learner turns have no output")
        if self.output is not None and self.output.reply != self.text:
            raise ValueError("tutor turn text must equal output.reply")
        return self

    @classmethod
    def tutor(cls, output: TutorOutput) -> Turn:
        return cls(role="tutor", text=output.reply, output=output)

    @classmethod
    def learner(cls, text: str) -> Turn:
        return cls(role="learner", text=text)


def output_json_schema() -> dict[str, object]:
    """The tutor output JSON Schema without generated titles (compact, for prompts and GBNF)."""
    return strip_titles(TutorOutput.model_json_schema(by_alias=True, mode="serialization"))


def strip_titles(schema: dict[str, object]) -> dict[str, object]:
    def walk(node: object, parent_key: str | None) -> object:
        if isinstance(node, dict):
            return {
                k: walk(v, k)
                for k, v in node.items()
                if not (k == "title" and parent_key != "properties")
            }
        if isinstance(node, list):
            return [walk(v, parent_key) for v in node]
        return node

    result = walk(schema, None)
    assert isinstance(result, dict)
    return result


def _norm(text: str) -> str:
    return " ".join(text.lower().split()).strip(" .,!?;:")
