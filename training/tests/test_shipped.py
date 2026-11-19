"""Scoring as shipped: the corrections the app's postValidate would drop are dropped."""

from __future__ import annotations

import json
from pathlib import Path

from datagen.filters import parse_tutor_output
from eval.__main__ import load_any_items
from eval.__main__ import main as eval_main
from eval.shipped import as_shipped, normalise_italian, shipped_predictions, span_in_message
from tests.helpers import output
from tests.test_learner_corpus import pair

APOSTROPHE = chr(0x2019)
LEARNER = "Ieri sono andato al mare con l'amica di Marco."


def move(raw: str) -> str:
    pred, errors = parse_tutor_output(raw)
    assert pred is not None, errors
    return pred.annotations.move


def test_normalise_italian_unifies_case_apostrophes_spaces_and_edges() -> None:
    assert normalise_italian(f"  «L{APOSTROPHE}Amica   di»! ") == "l'amica di"


def test_span_must_be_whole_words_of_the_message() -> None:
    assert span_in_message("andato al mare", LEARNER)
    assert span_in_message(f"L{APOSTROPHE}amica", LEARNER)
    assert span_in_message("dell'", "Parlo dell'amica.")
    assert not span_in_message("andat", LEARNER)
    assert not span_in_message("al cinema", LEARNER)
    assert not span_in_message("", LEARNER)


def test_kept_corrections_are_unchanged() -> None:
    raw = output(
        "Al mare, che bello!", recast=("al mare", "in spiaggia", ["word-choice"])
    ).to_json()
    assert move(as_shipped(raw, LEARNER)) == "recast"
    raw = output("Con chi?", prompt=("l'amica", ["article-use"])).to_json()
    assert move(as_shipped(raw, LEARNER)) == "prompt"


def test_corrections_the_app_drops_become_none() -> None:
    not_said = output("Ah!", prompt=("al cinema", ["preposition"])).to_json()
    rewrite = output(
        "Ah!", recast=("mare", "mare con tutti i miei amici di scuola e di lavoro", ["word-choice"])
    ).to_json()
    odd = output("Ah!", recast=("al mare", "al mare 🙂", ["preposition"])).to_json()
    for raw in (not_said, rewrite, odd):
        shipped = as_shipped(raw, LEARNER)
        assert move(shipped) == "none"
        assert json.loads(shipped)["reply"] == "Ah!"


def test_a_turn_with_both_moves_keeps_the_recast() -> None:
    payload = json.loads(
        output("Ah!", recast=("al mare", "in spiaggia", ["word-choice"])).to_json()
    )
    payload["annotations"]["prompt"] = {"learnerText": "al mare", "errorTags": ["preposition"]}
    assert parse_tutor_output(json.dumps(payload))[0] is None
    assert move(as_shipped(json.dumps(payload), LEARNER)) == "recast"


def test_an_unchanged_recast_is_dropped_not_invalid() -> None:
    payload = json.loads(
        output("Ah!", recast=("al mare", "in spiaggia", ["word-choice"])).to_json()
    )
    payload["annotations"]["recast"]["correctedText"] = "Al mare"
    assert parse_tutor_output(json.dumps(payload))[0] is None
    assert move(as_shipped(json.dumps(payload), LEARNER)) == "none"


def test_invalid_text_stays_invalid_and_unknown_items_are_untouched() -> None:
    assert as_shipped("not json", LEARNER) == "not json"
    assert as_shipped("[1, 2]", LEARNER) == "[1, 2]"
    raw = output("Ah!", prompt=("al cinema", ["preposition"])).to_json()
    got = shipped_predictions({"a": raw, "b": raw}, {"a": LEARNER})
    assert move(got["a"]) == "none"
    assert got["b"] == raw


def test_learner_report_as_shipped_drops_a_flag_on_words_not_said(tmp_path: Path) -> None:
    pairs_path = tmp_path / "pairs.jsonl"
    rows = [pair("Mi piace il gelato.", "Mi piace il gelato.")]
    pairs_path.write_text("".join(json.dumps(p.to_wire()) + "\n" for p in rows), encoding="utf-8")
    items_path = tmp_path / "items.jsonl"
    assert eval_main(["learner-items", "--pairs", str(pairs_path), "--out", str(items_path)]) == 0
    item_id = load_any_items(items_path)[0].id
    flag = output("Ah sì?", prompt=("la torta", ["article-use"])).to_json()
    preds_path = tmp_path / "preds.jsonl"
    preds_path.write_text(
        json.dumps({"itemId": item_id, "system": "student", "text": flag}) + "\n", encoding="utf-8"
    )
    args = ["learner-report", "--items", str(items_path), "--predictions", str(preds_path)]
    raw, shipped = tmp_path / "raw.md", tmp_path / "shipped.md"
    assert eval_main([*args, "--system", "student", "--out", str(raw)]) == 0
    assert eval_main([*args, "--system", "student", "--out", str(shipped), "--as-shipped"]) == 0
    assert "| student | - | 100.0% (1/1) |" in raw.read_text(encoding="utf-8")
    assert "| student | - | 0.0% (0/1) |" in shipped.read_text(encoding="utf-8")
