from __future__ import annotations

import json

import jsonschema
import pytest
from pydantic import ValidationError

from spec.__main__ import SCHEMA_DIR, dump, schemas
from spec.levels import BANDS, Level, band_for
from spec.models import START_MESSAGE, ErrorHistoryItem, LearnerProfile, Turn, TutorContext
from spec.policy import expected_move, pick_target_error, prompted_tags
from spec.render import allowed_grammar_slugs, render_messages, render_system_prompt
from spec.scenarios import load_library
from spec.taxonomy import error_tags, grammar_points, tags_for_level
from tests.helpers import context, output


def test_committed_schemas_match_models() -> None:
    for name, schema in schemas().items():
        assert (SCHEMA_DIR / name).read_text(encoding="utf-8") == dump(schema), (
            f"{name} is stale: run `python -m spec export-schema`"
        )


def test_output_serialises_reply_first_and_validates_against_schema() -> None:
    out = output("Un cappuccino?", prompt=("un cappuccino caldo", ["article-use"]))
    text = out.to_json()
    assert text.startswith('{"reply":"Un cappuccino?","annotations":{"prompt":')
    schema = json.loads((SCHEMA_DIR / "tutor_output.v1.schema.json").read_text())
    jsonschema.validate(json.loads(text), schema)


def test_output_rejects_prompt_and_recast_together() -> None:
    with pytest.raises(ValidationError, match="not both"):
        output("x", prompt=("a", ["spelling"]), recast=("a", "b", ["spelling"]))


def test_recast_must_change_the_text() -> None:
    with pytest.raises(ValidationError, match="differ"):
        output("x", recast=("Io vado.", "io vado", ["verb-form"]))


def test_annotations_move_and_tags() -> None:
    assert output("Bene!").annotations.move == "none"
    assert output("Bene?", prompt=("la mia madre", ["possessive"])).annotations.move == "prompt"
    rec = output("Sì, mia madre.", recast=("la mia madre", "mia madre", ["possessive"]))
    assert rec.annotations.move == "recast"
    assert rec.annotations.error_tags == ["possessive"]


def test_turn_text_must_match_reply() -> None:
    with pytest.raises(ValidationError):
        Turn(role="tutor", text="other", output=output("Ciao!"))
    with pytest.raises(ValidationError):
        Turn(role="learner", text="ciao", output=output("Ciao!"))


def test_bands_are_monotonic() -> None:
    ordered = [BANDS[lv] for lv in Level]
    assert [b.lemma_ceiling for b in ordered] == sorted(b.lemma_ceiling for b in ordered)
    assert band_for(Level.A2, 1500).lemma_ceiling == 1500
    assert band_for(Level.A2).lemma_ceiling == 1000
    with pytest.raises(ValueError):
        band_for(Level.A1, 0)


def test_taxonomy_maps_to_known_grammar_points() -> None:
    points = grammar_points()
    for tag in error_tags().values():
        assert all(g in points for g in tag.grammar_points)
        assert tag.example_wrong != tag.example_right
    assert error_tags()["auxiliary-choice"].min_level == Level.A2
    assert error_tags()["spelling"].min_level == Level.A1
    a1 = {t.id for t in tags_for_level(Level.A1)}
    assert "auxiliary-choice" not in a1
    assert "subjunctive-use" in {t.id for t in tags_for_level(Level.B1)}


def test_content_grammar_ids_are_kept() -> None:
    points = grammar_points()
    assert points["noun-gender-number"].content_id == 1
    assert points["conditional"].content_id == 38
    assert points["congiuntivo-presente"].content_id is None


def test_scenario_library_is_large_and_covers_all_levels() -> None:
    library = load_library()
    assert len(library) >= 60
    for level in Level:
        assert sum(level in s.levels for s in library.values()) >= 12
    evals = [s for s in library.values() if s.split == "eval"]
    assert {lv for s in evals for lv in s.levels} == set(Level)
    assert len(evals) >= 6


def test_render_system_prompt_is_level_controlled() -> None:
    a1 = render_system_prompt(context("bar-colazione", Level.A1))
    a2 = render_system_prompt(context("bar-colazione", Level.A2))
    assert "500 most common" in a1 and "1000 most common" in a2
    assert "at most 8 words" in a1
    assert "Lei (formal)" in a1
    assert "English word in brackets" in a1 and "English word in brackets" not in a2
    assert "Passato prossimo with avere" in a2 and "Passato prossimo with avere" not in a1
    assert "[order-drink]" in a1
    assert "$" not in a1


def test_render_uses_known_grammar_and_history() -> None:
    ctx = TutorContext(
        learner=LearnerProfile(
            level=Level.A2,
            lemma_ceiling=750,
            known_grammar=["present-are", "negation"],
            error_history=[ErrorHistoryItem(tag="article-form", count=4)],
        ),
        scenario=load_library()["presentarsi"],
    )
    prompt = render_system_prompt(ctx)
    assert "750 most common" in prompt
    assert "structures: Present tense: regular -are verbs; Negation with non" in prompt
    assert "Recurring learner errors" in prompt and "article-form, 4x" in prompt
    assert allowed_grammar_slugs(ctx) == ["present-are", "negation"]


def test_render_rejects_unknown_grammar() -> None:
    ctx = TutorContext(
        learner=LearnerProfile(level=Level.A1, known_grammar=["no-such-point"]),
        scenario=load_library()["presentarsi"],
    )
    with pytest.raises(ValueError, match="unknown grammar"):
        render_system_prompt(ctx)


def test_render_messages_alternate_and_carry_json() -> None:
    first = output("Buongiorno! Cosa prende?")
    messages = render_messages(context(), [Turn.tutor(first), Turn.learner("Un caffè, grazie.")])
    assert [m["role"] for m in messages] == ["system", "user", "assistant", "user"]
    assert messages[1]["content"] == START_MESSAGE
    assert json.loads(messages[2]["content"])["reply"] == "Buongiorno! Cosa prende?"
    with pytest.raises(ValueError, match="alternate"):
        render_messages(context(), [Turn.learner("Ciao")])


def test_policy_prompt_then_recast() -> None:
    assert expected_move([]) == "none"
    assert expected_move(["auxiliary-choice"]) == "prompt"
    assert expected_move(["auxiliary-choice"], ["auxiliary-choice"]) == "recast"
    assert expected_move(["word-choice"]) == "recast"  # lexical errors block meaning
    prev = output("Ho andato?", prompt=("ho andato", ["auxiliary-choice"]))
    assert prompted_tags(prev) == ["auxiliary-choice"]
    assert prompted_tags(output("Bene.")) == []
    assert prompted_tags(None) == []


def test_pick_target_error_prefers_focus_then_history() -> None:
    scenario = load_library()["weekend-scorso"]  # focus: passato prossimo
    assert pick_target_error(["spelling", "auxiliary-choice"], scenario) == "auxiliary-choice"
    assert pick_target_error(["spelling", "noun-gender"], None, ["spelling"]) == "spelling"
    assert pick_target_error(["noun-number", "noun-gender"]) == "noun-gender"
    assert pick_target_error([]) is None
    assert pick_target_error(["not-a-tag"]) is None
