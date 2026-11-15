"""CPU smoke test of an exported GGUF with llama-cpp-python (the `export` extra).

Runs a few tutor prompts at different levels with the output JSON Schema enforced as a
grammar (as llama.rn does on the phone) and checks each answer parses and is sensible.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from datagen.filters import parse_tutor_output
from spec.levels import Level
from spec.models import (
    Annotations,
    LearnerProfile,
    ScenarioProgress,
    Turn,
    TutorContext,
    TutorOutput,
    output_json_schema,
)
from spec.render import ChatMessage, render_messages
from spec.scenarios import load_library


@dataclass(frozen=True)
class SmokeCase:
    name: str
    messages: list[ChatMessage]
    expect_correction: bool


def _opening(scenario_id: str) -> TutorOutput:
    scenario = load_library()[scenario_id]
    return TutorOutput(
        reply=scenario.opening,
        annotations=Annotations(
            prompt=None,
            recast=None,
            new_words=[],
            scenario_progress=ScenarioProgress(goals_completed=[], done=False),
        ),
    )


def smoke_cases() -> list[SmokeCase]:
    library = load_library()
    cases = [
        (
            "a1-bar-correct",
            "bar-colazione",
            Level.A1,
            "Buongiorno! Vorrei un cappuccino, per favore.",
            False,
        ),
        (
            "a2-weekend-auxiliary",
            "weekend-scorso",
            Level.A2,
            "Sabato ho andato al mare con mia sorella.",
            True,
        ),
        (
            "b1-flat-agreement",
            "affittare-appartamento",
            Level.B1,
            "L'appartamento è molto bello, ma la cucina è piccolo.",
            True,
        ),
    ]
    out = []
    for name, scenario_id, level, learner, correction in cases:
        context = TutorContext(learner=LearnerProfile(level=level), scenario=library[scenario_id])
        turns = [Turn.tutor(_opening(scenario_id)), Turn.learner(learner)]
        out.append(SmokeCase(name, render_messages(context, turns), correction))
    return out


@dataclass(frozen=True)
class SmokeResult:
    case: str
    valid: bool
    """The answer parses against the output schema (a failure here blocks release)."""
    behaved: bool
    """It corrected exactly when a correction was due (a warning: the eval decides quality)."""
    detail: str
    text: str


def check_answer(case: SmokeCase, text: str) -> SmokeResult:
    parsed, errors = parse_tutor_output(text)
    if parsed is None:
        return SmokeResult(case.name, False, False, f"invalid output: {errors[:2]}", text)
    move = parsed.annotations.move
    behaved = (move != "none") == case.expect_correction
    want = "a correction" if case.expect_correction else "no correction"
    detail = move if behaved else f"expected {want}, got {move}"
    return SmokeResult(case.name, True, behaved, detail, text)


Complete = Callable[[list[ChatMessage]], str]


def run_smoke(complete: Complete, cases: list[SmokeCase] | None = None) -> list[SmokeResult]:
    return [check_answer(case, complete(case.messages)) for case in cases or smoke_cases()]


def llama_cpp_completer(model: Path, *, threads: int | None = None, n_ctx: int = 4096) -> Complete:
    from llama_cpp import Llama

    llm = Llama(
        model_path=str(model), n_ctx=n_ctx, n_threads=threads, n_gpu_layers=0, verbose=False, seed=0
    )
    schema = output_json_schema()

    def complete(messages: list[ChatMessage]) -> str:
        result: Any = llm.create_chat_completion(
            messages=[dict(m) for m in messages],  # type: ignore[misc]
            temperature=0.0,
            max_tokens=400,
            response_format={"type": "json_object", "schema": schema},
        )
        return str(result["choices"][0]["message"]["content"])

    return complete
