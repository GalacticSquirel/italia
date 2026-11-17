"""Every file generated from the spec, and the one place that writes and checks them.

The app cannot read YAML or run Python, so `python -m spec export-schema` writes:

- `schema/*.schema.json`: JSON Schemas of the model I/O, from the pydantic models;
- `packages/core/src/tutor/spec.generated.ts`: the app's copy of the spec (system prompt
  template, error tags, grammar points, level bands, output schema and the scenario library);
- `generated/render_cases.v1.json`: tutor contexts and dialogues with the exact system prompt
  and chat messages that `render.py` produces for them. The app's TypeScript port of the
  renderer is tested against these, so the phone always sends the prompt the model was trained
  on.

`python -m spec check` and a test fail while any of them is stale, so a change to the spec
cannot land without its generated files.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from spec.levels import BANDS, Level
from spec.models import (
    SPEC_VERSION,
    START_MESSAGE,
    Annotations,
    ErrorHistoryItem,
    LearnerProfile,
    NewWord,
    Prompt,
    Recast,
    Scenario,
    ScenarioProgress,
    Turn,
    TutorContext,
    TutorOutput,
    strip_titles,
)
from spec.render import TEMPLATE_FILE, render_messages
from spec.scenarios import load_library
from spec.taxonomy import SPEC_DIR

MAJOR = SPEC_VERSION.split(".")[0]
REPO_DIR = SPEC_DIR.parents[1]
SCHEMA_DIR = SPEC_DIR / "schema"
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


def schemas() -> dict[str, dict[str, Any]]:
    """JSON Schemas generated from the models, by file name (inside `SCHEMA_DIR`)."""
    out: dict[str, dict[str, Any]] = {}
    for name, model in (
        ("tutor_output", TutorOutput),
        ("tutor_context", TutorContext),
        ("scenario", Scenario),
    ):
        schema = strip_titles(model.model_json_schema(by_alias=True, mode="serialization"))
        out[f"{name}.v{MAJOR}.schema.json"] = {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "$id": f"https://italia.app/schemas/tutor/{name}.v{MAJOR}.schema.json",
            "x-spec-version": SPEC_VERSION,
            **schema,
        }
    return out


def dump(data: object) -> str:
    """A generated JSON file's text."""
    return json.dumps(data, ensure_ascii=False, indent=2) + "\n"


def _ts(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2)


def _spec_json(name: str) -> dict[str, Any]:
    data: dict[str, Any] = json.loads((SPEC_DIR / name).read_text(encoding="utf-8"))
    return data


def app_module() -> str:
    """`packages/core/src/tutor/spec.generated.ts`: the spec as TypeScript constants."""
    tags = _spec_json("error_tags.json")
    bands = {
        level.value: {
            "level": level.value,
            "lemmaCeiling": band.lemma_ceiling,
            "maxWordsPerSentence": band.max_words_per_sentence,
            "maxSentences": band.max_sentences,
            "maxNewWords": band.max_new_words,
            "maxOutOfBandRatio": band.max_out_of_band_ratio,
            "englishAllowed": band.english_allowed,
        }
        for level, band in BANDS.items()
    }
    template = TEMPLATE_FILE.read_text(encoding="utf-8")
    points = _spec_json("grammar_points.json")["points"]
    output_schema = schemas()[f"tutor_output.v{MAJOR}.schema.json"]
    return f"""// Generated by `python -m spec export-schema` (training/spec/bundle.py).
// Do not edit: change training/spec and run `uv run python -m spec export-schema` in training/.
import type {{
  ErrorTagInfo,
  GrammarPointInfo,
  LevelBand,
  TutorLevel,
  TutorScenario,
}} from './types';

/** Version of the tutor spec this module was generated from. */
export const SPEC_VERSION = {_ts(SPEC_VERSION)};

/** The first user message of every conversation: tells the tutor to open the scenario. */
export const START_MESSAGE = {_ts(START_MESSAGE)};

/** `training/spec/{TEMPLATE_FILE.name}`, a Python `string.Template`. */
export const SYSTEM_PROMPT_TEMPLATE = {_ts(template)};

/** Version of the error-tag taxonomy. */
export const TAXONOMY_VERSION = {_ts(tags["version"])};

/** Learner error tags, in taxonomy order (`training/spec/error_tags.json`). */
export const ERROR_TAGS: readonly ErrorTagInfo[] = {_ts(tags["tags"])};

/** Grammar points in teaching order (`training/spec/grammar_points.json`); `id` is the content
 * id. */
export const GRAMMAR_POINTS: readonly GrammarPointInfo[] = {_ts(points)};

/** Limits for tutor replies at each level (`training/spec/levels.py`). */
export const LEVEL_BANDS: Readonly<Record<TutorLevel, LevelBand>> = {_ts(bands)};

/** JSON Schema of one tutor turn (`training/spec/schema/tutor_output.v{MAJOR}.schema.json`). */
export const TUTOR_OUTPUT_SCHEMA: Readonly<Record<string, unknown>> = {_ts(output_schema)};

/** The scenario library (`training/scenarios/*.yaml`, validated by the spec). */
export const SCENARIOS: readonly TutorScenario[] = {_ts(scenario_bundle()["scenarios"])};
"""


APP_MODULE = REPO_DIR / "packages/core/src/tutor/spec.generated.ts"


def generated_outputs() -> dict[Path, str]:
    """Every generated file's text, by path."""
    out = {SCHEMA_DIR / name: dump(schema) for name, schema in schemas().items()}
    out[GENERATED_DIR / f"render_cases.v{MAJOR}.json"] = dump(render_cases())
    out[APP_MODULE] = app_module()
    return out


def stale_outputs() -> list[Path]:
    """Generated files that are missing or differ from what the spec generates now."""
    return [
        path
        for path, text in generated_outputs().items()
        if not path.exists() or path.read_text(encoding="utf-8") != text
    ]


def write_outputs() -> list[Path]:
    """Write every generated file; returns the paths written."""
    outputs = generated_outputs()
    for path, text in outputs.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8", newline="\n")
    return list(outputs)
