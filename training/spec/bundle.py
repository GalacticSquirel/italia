"""Files generated from the spec for the app: the scenario library and golden render cases.

The app cannot read YAML or run Python, so `python -m spec export-schema` also writes:

- `generated/scenarios.v1.json`: every scenario as validated wire JSON (camelCase), which the
  app bundles at build time;
- `generated/render_cases.v1.json`: tutor contexts and dialogues with the exact system prompt
  and chat messages that `render.py` produces for them. The app's TypeScript port of the
  renderer is tested against these, so the phone always sends the prompt the model was trained
  on.

`python -m spec check` and a test fail while either file is stale.
"""

from __future__ import annotations

from typing import Any

from spec.levels import Level
from spec.models import (
    SPEC_VERSION,
    Annotations,
    ErrorHistoryItem,
    LearnerProfile,
    NewWord,
    Prompt,
    Recast,
    ScenarioProgress,
    Turn,
    TutorContext,
    TutorOutput,
)
from spec.render import render_messages
from spec.scenarios import load_library
from spec.taxonomy import SPEC_DIR

GENERATED_DIR = SPEC_DIR / "generated"


def scenario_bundle() -> dict[str, Any]:
    """The scenario library as wire JSON, sorted by id."""
    return {
        "specVersion": SPEC_VERSION,
        "scenarios": [s.to_wire() for s in load_library().values()],
    }


def _output(
    reply: str,
    goals: list[str],
    *,
    prompt: Prompt | None = None,
    recast: Recast | None = None,
    new_words: list[NewWord] | None = None,
    done: bool = False,
) -> TutorOutput:
    return TutorOutput(
        reply=reply,
        annotations=Annotations(
            prompt=prompt,
            recast=recast,
            new_words=new_words or [],
            scenario_progress=ScenarioProgress(goals_completed=goals, done=done),
        ),
    )


def _cases() -> list[tuple[str, TutorContext, list[Turn]]]:
    library = load_library()
    bar = library["bar-colazione"]
    return [
        (
            "a1-default-opening",
            TutorContext(learner=LearnerProfile(level=Level.A1), scenario=bar),
            [],
        ),
        (
            "a2-ceiling-grammar-history-dialogue",
            TutorContext(
                learner=LearnerProfile(
                    level=Level.A2,
                    lemma_ceiling=750,
                    known_grammar=["present-are", "negation", "definite-articles"],
                    error_history=[
                        ErrorHistoryItem(tag="article-form", count=4, last_example="il studente"),
                        ErrorHistoryItem(tag="auxiliary-choice", count=2),
                    ],
                ),
                scenario=library["biglietto-treno"],
            ),
            [
                Turn.tutor(_output("Buongiorno! Dove vuole andare?", [])),
                Turn.learner("Voglio andare a Roma. Ieri ho andato a Napoli."),
                Turn.tutor(
                    _output(
                        "Ho andato? È sicura?",
                        ["destination"],
                        prompt=Prompt(learner_text="ho andato", error_tags=["auxiliary-choice"]),
                    )
                ),
                Turn.learner("Sì, ho andato a Napoli."),
                Turn.tutor(
                    _output(
                        "Ah, è andata a Napoli! Che bello. Andata e ritorno per Roma?",
                        ["destination"],
                        recast=Recast(
                            learner_text="Ho andato",
                            corrected_text="Sono andata",
                            error_tags=["auxiliary-choice"],
                        ),
                        new_words=[NewWord(lemma="bello", gloss_en="nice")],
                    )
                ),
            ],
        ),
        (
            "b1-informal",
            TutorContext(
                learner=LearnerProfile(level=Level.B1), scenario=library["consigli-viaggio"]
            ),
            [],
        ),
        (
            "b2-formal-done",
            TutorContext(
                learner=LearnerProfile(level=Level.B2, lemma_ceiling=4000),
                scenario=library["colloquio-lavoro"],
            ),
            [
                Turn.tutor(_output("Buongiorno, si accomodi.", ["intro"], done=False)),
                Turn.learner("Grazie mille."),
                Turn.tutor(_output("Arrivederci!", ["intro", "why"], done=True)),
            ],
        ),
    ]


def render_cases() -> dict[str, Any]:
    """Golden contexts, dialogues and the messages `render_messages` makes from them."""
    cases = []
    for name, context, turns in _cases():
        cases.append(
            {
                "name": name,
                "context": context.to_wire(),
                "turns": [t.to_wire() for t in turns],
                "messages": render_messages(context, turns),
            }
        )
    return {"specVersion": SPEC_VERSION, "cases": cases}


def generated_files() -> dict[str, dict[str, Any]]:
    """Generated files by name (inside `GENERATED_DIR`)."""
    major = SPEC_VERSION.split(".")[0]
    return {
        f"scenarios.v{major}.json": scenario_bundle(),
        f"render_cases.v{major}.json": render_cases(),
    }
