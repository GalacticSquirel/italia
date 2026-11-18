"""MERLIN sentence pairs and the real-learner check built on them."""

from __future__ import annotations

import json
import zipfile
from pathlib import Path

import pytest

from datagen.learner_corpus import (
    MERLIN_TEXTS,
    LearnerPair,
    MerlinText,
    detokenize,
    fetch_merlin,
    pairs_from_text,
    pairs_from_zip,
    parse_text,
    sentence_pairs,
    split_for,
)
from datagen.teacher import ScriptedClient
from eval.__main__ import load_any_items
from eval.__main__ import main as eval_main
from eval.learner import (
    SCENARIO_ID,
    build_learner_items,
    matches_native,
    render_learner_report,
    score_learner,
)
from eval.predict import SystemSpec, load_predictions, predict
from spec.levels import Level
from tests.helpers import output

# The layout of a `meta_ltext_THs` file; the text is made up for the test.
MERLIN_FILE = """METADATA

General:
Author ID: 9999_0000001
Test language: Italian
CEFR level of test: B1
Task : writing to a friend - ID: 9999_000000-1
Mother tongue: German

Rating:
Overall CEFR rating: A2

----------------

Learner text:

Cara Anna,
ieri sono andato al mare con mia sorella. L<APOSTROPHE>acqua era molto fredda!
Abito in Città X da due anni. Ci vediamo presto?

----------------

Target hypothesis 1:

Cara Anna , ieri sono andato al mare con mia sorella . L' acqua era molto fredda !
Abito a Città X da due anni . Ci vediamo presto ?

----------------

No target hypothesis 2 available.
""".replace("<APOSTROPHE>", chr(0x2019))


def pair(learner: str, native: str, *, level: Level = Level.A2, n: int = 0) -> LearnerPair:
    return LearnerPair(
        id=f"merlin-test-{level}-{n}",
        author="test",
        level=level,
        l1="German",
        task="writing to a friend",
        learner=learner,
        native=native,
        changed=learner.lower() != native.lower(),
        split="eval",
    )


def test_parse_text_reads_metadata_and_both_texts() -> None:
    text = parse_text(MERLIN_FILE)
    assert (text.author, text.level, text.l1) == ("9999_0000001", "A2", "German")
    assert text.task == "writing to a friend"
    assert text.learner.startswith("Cara Anna, ieri")
    assert "L'acqua" in text.learner  # typographic apostrophe normalised
    assert text.target.endswith("Ci vediamo presto ?")


def test_sentences_are_cut_at_the_native_sentence_ends() -> None:
    got = list(sentence_pairs(parse_text(MERLIN_FILE)))
    assert got == [
        (
            "Cara Anna, ieri sono andato al mare con mia sorella.",
            "Cara Anna, ieri sono andato al mare con mia sorella.",
        ),
        ("L'acqua era molto fredda!", "L'acqua era molto fredda!"),
        ("Abito in Città X da due anni.", "Abito a Città X da due anni."),
        ("Ci vediamo presto?", "Ci vediamo presto?"),
    ]


def test_pairs_drop_placeholders_and_short_sentences_and_ignore_punctuation() -> None:
    pairs = pairs_from_text(parse_text(MERLIN_FILE))
    assert [p.learner for p in pairs] == [
        "Cara Anna, ieri sono andato al mare con mia sorella.",
        "L'acqua era molto fredda!",
        "Ci vediamo presto?",
    ]
    assert [p.changed for p in pairs] == [False, False, False]
    assert {p.split for p in pairs} == {split_for("9999_0000001")}
    changed = MerlinText(
        "a", "B1", "French", "t", "io sono andato al mare ieri", "Sono andato al mare ieri ."
    )
    assert pairs_from_text(changed)[0].changed
    assert not pairs_from_text(
        MerlinText("a", "unrated", "French", "t", "Sono qui oggi.", "Sono qui oggi .")
    )


def test_detokenize_restores_italian_spacing() -> None:
    assert detokenize(["L'", "acqua", ",", "dice", '"', "è", "fredda", '"', "."]) == (
        'L\'acqua, dice "è fredda".'
    )


def test_authors_are_split_stably() -> None:
    splits = [split_for(f"author-{i}") for i in range(500)]
    assert splits == [split_for(f"author-{i}") for i in range(500)]
    assert 0.1 < splits.count("eval") / len(splits) < 0.3


def test_pairs_from_zip_reads_only_the_italian_texts(tmp_path: Path) -> None:
    archive = tmp_path / "merlin.zip"
    with zipfile.ZipFile(archive, "w") as z:
        z.writestr(MERLIN_TEXTS + "a.txt", MERLIN_FILE)
        z.writestr("merlin-text-v1.2/meta_ltext_THs/german/a.txt", MERLIN_FILE)
    assert len(pairs_from_zip(archive)) == 3


def test_fetch_refuses_a_file_that_is_not_the_pinned_release(tmp_path: Path) -> None:
    dest = tmp_path / "merlin.zip"
    dest.write_bytes(b"not merlin")
    with pytest.raises(ValueError, match="sha256"):
        fetch_merlin(dest)


def test_learner_items_are_held_out_balanced_and_rendered() -> None:
    pairs = [pair(f"Io vado a casa {i}.", f"Vado a casa {i}.", n=i) for i in range(5)]
    pairs += [pair(f"Vado a casa {i}.", f"Vado a casa {i}.", n=10 + i) for i in range(5)]
    pairs.append(
        pair("Vado a scuola.", "Vado a scuola.", n=99).model_copy(update={"split": "train"})
    )
    items = build_learner_items(pairs, per_group=3)
    assert len(items) == 6
    assert sum(i.changed for i in items) == 3
    assert all(i.context.scenario.id == SCENARIO_ID for i in items)
    assert items[0].messages[-1] == {"role": "user", "content": items[0].learner_text}
    assert items[0].messages[-2]["role"] == "assistant"


def test_matches_native_needs_both_spans() -> None:
    item = build_learner_items(
        [pair("Abito in Roma da due anni.", "Abito a Roma da due anni.")], per_group=1
    )[0]
    assert matches_native("in Roma", "a Roma", item)
    assert not matches_native("in Roma", "a Milano", item)
    assert not matches_native("al Roma", "a Roma", item)


def test_score_learner_counts_detection_false_flags_and_native_fixes() -> None:
    pairs = [
        pair("Abito in Roma da due anni.", "Abito a Roma da due anni.", n=1),
        pair("Ieri ho andato al cinema.", "Ieri sono andato al cinema.", n=2),
        pair("Mi piace il gelato.", "Mi piace il gelato.", n=3),
        pair("Vado al lavoro in bici.", "Vado al lavoro in bici.", n=4),
    ]
    items = build_learner_items(pairs, per_group=5)
    by_text = {i.learner_text: i.id for i in items}
    preds = {
        by_text["Abito in Roma da due anni."]: output(
            "Ah, a Roma!", recast=("in Roma", "a Roma", ["preposition"])
        ).to_json(),
        by_text["Ieri ho andato al cinema."]: output("Che film hai visto?").to_json(),
        by_text["Mi piace il gelato."]: output(
            "Ah sì?", prompt=("il gelato", ["article"])
        ).to_json(),
        by_text["Vado al lavoro in bici."]: "not json",
    }
    scores = score_learner("student", items, preds)
    t = scores.total
    assert (t.changed, t.detected, t.recasts, t.native_fixes) == (2, 1, 1, 1)
    assert (t.unchanged, t.flagged, t.invalid) == (2, 1, 1)
    report = render_learner_report("Check", [scores])
    assert "| student | 50.0% (1/2) | 50.0% (1/2) | 100.0% (1/1) | 1 |" in report
    assert "## student by level" in report


def test_learner_cli_builds_items_predicts_and_reports(tmp_path: Path) -> None:
    pairs_path = tmp_path / "pairs.jsonl"
    rows = [pair("Abito in Roma da due anni.", "Abito a Roma da due anni.", n=1)]
    rows.append(pair("Mi piace il gelato.", "Mi piace il gelato.", n=2))
    pairs_path.write_text("".join(json.dumps(p.to_wire()) + "\n" for p in rows), encoding="utf-8")
    items_path = tmp_path / "items.jsonl"
    assert eval_main(["learner-items", "--pairs", str(pairs_path), "--out", str(items_path)]) == 0
    items = load_any_items(items_path)
    spec = SystemSpec.model_validate(
        {"name": "student", "endpoint": {"protocol": "openai", "baseUrl": "http://x", "model": "m"}}
    )
    preds_path = tmp_path / "preds.jsonl"
    assert predict(spec, items, preds_path, client=ScriptedClient([output("Bene!").to_json()])) == 2
    assert len(load_predictions(preds_path, "student")) == 2
    report = tmp_path / "report.md"
    args = ["learner-report", "--items", str(items_path), "--predictions", str(preds_path)]
    assert eval_main([*args, "--system", "student", "--out", str(report)]) == 0
    assert "| student | 0.0% (0/1) | 0.0% (0/1) | - | 0 |" in report.read_text(encoding="utf-8")
