"""Hand-written dialogue compiler: YAML -> DialogueRecord, plan derivation, filters."""

from __future__ import annotations

from pathlib import Path

import pytest

from datagen.handwritten import AuthoringError, compile_set, load_handwritten, main
from datagen.jsonutil import write_jsonl
from datagen.languagetool import NullChecker

GOOD = """\
- scenario: bar-colazione
  level: A1
  persona: en-f-student
  history: [noun-gender]
  turns:
    - tutor: Buongiorno! Cosa prende?
    - learner: Buongiorno! Vorrei un cappuccino, per favore.
    - tutor: Certo, un cappuccino. Vuole anche un cornetto?
      goals: [greet, order-drink]
    - learner: Sì, una cornetto, per favore.
      errors: [noun-gender]
    - tutor: Una cornetto? Pensi a il o la...
      prompt: {text: una cornetto, tags: [noun-gender]}
    - learner: Una cornetto, scusi.
      errors: [noun-gender]
    - tutor: Ah, un cornetto! Ecco il cappuccino e il cornetto.
      goals: [order-food]
      recast: {text: Una cornetto, fix: un cornetto, tags: [noun-gender]}
    - learner: Grazie. Quanto costa?
    - tutor: Sono tre euro. Ecco lo scontrino.
    - learner: Ecco tre euro. Arrivederci!
    - tutor: Grazie a Lei! Buona giornata!
      goals: [pay]
"""


def _write(tmp_path: Path, text: str) -> Path:
    folder = tmp_path / "src" / "t"
    folder.mkdir(parents=True)
    (folder / "d.yaml").write_text(text, encoding="utf-8")
    return tmp_path / "src"


def test_compiles_plan_goals_and_done(tmp_path: Path) -> None:
    records, problems = compile_set("t", grammar=NullChecker(), source_dir=_write(tmp_path, GOOD))
    assert problems == []
    (record,) = records
    assert record.teacher == "handwritten"
    assert record.id.startswith("hw-t-")
    assert [p.kind for p in record.plan] == [
        "fresh",
        "fresh",
        "repair-fail",
        "fresh",
        "fresh",
    ]
    assert [p.expected_move for p in record.plan] == ["none", "prompt", "recast", "none", "none"]
    last = record.turns[-1].output
    assert last is not None
    assert last.annotations.scenario_progress.done is True
    assert last.annotations.scenario_progress.goals_completed == [
        "greet",
        "order-drink",
        "order-food",
        "pay",
    ]
    assert record.context.learner.error_history[0].tag == "noun-gender"
    assert record.filter is not None and record.filter.passed, record.filter


def test_wrong_move_fails_policy(tmp_path: Path) -> None:
    bad = GOOD.replace("      prompt: {text: una cornetto, tags: [noun-gender]}\n", "")
    records, _ = compile_set("t", grammar=NullChecker(), source_dir=_write(tmp_path, bad))
    assert records[0].filter is not None
    assert not records[0].filter.passed


def test_rejects_eval_scenarios_and_unknown_ids(tmp_path: Path) -> None:
    bad = GOOD.replace("bar-colazione", "gelateria")
    records, problems = compile_set("t", grammar=NullChecker(), source_dir=_write(tmp_path, bad))
    assert records == [] and "evaluation scenario" in problems[0]
    with pytest.raises(AuthoringError):
        compile_set("missing", grammar=NullChecker(), source_dir=tmp_path)


def test_build_writes_only_passing_and_load(tmp_path: Path) -> None:
    src = _write(tmp_path, GOOD)
    status = main(
        ["build", "t", "--no-languagetool", "--source-dir", str(src), "--out-dir", str(tmp_path)]
    )
    assert status == 0
    loaded = load_handwritten([tmp_path / "t.jsonl"])
    assert len(loaded) == 1
    write_jsonl(tmp_path / "x.jsonl", [loaded[0].model_copy(update={"filter": None}).to_wire()])
    assert load_handwritten([tmp_path / "x.jsonl"]) == []


BENCH = """\
- scenario: gelateria
  level: A1
  persona: es-m-worker
  turns:
    - tutor: Buonasera! Cono o coppetta?
    - learner: Una cono piccolo, per favore.
      errors: [noun-gender]
      gold: {text: Una cono, fix: Un cono}
    - tutor: Una cono? Cono è maschile o femminile?
      prompt: {text: Una cono, tags: [noun-gender]}
    - learner: Un cono piccolo, per favore.
    - tutor: Perfetto! Quali gusti vuole?
      goals: [choose-size]
    - learner: Cioccolato e fragola.
    - tutor: Ottima scelta. Sono due euro e cinquanta.
      goals: [choose-flavours]
    - learner: Ecco a Lei. Grazie!
    - tutor: Grazie a Lei, arrivederci!
      goals: [pay]
"""


def test_gold_spans_from_source_or_recast(tmp_path: Path) -> None:
    with_gold = GOOD.replace(
        "      errors: [noun-gender]\n    - tutor: Una cornetto?",
        "      errors: [noun-gender]\n      gold: {text: una cornetto, fix: un cornetto}\n"
        "    - tutor: Una cornetto?",
    )
    records, problems = compile_set(
        "t", grammar=NullChecker(), source_dir=_write(tmp_path, with_gold)
    )
    assert problems == []
    prompt_step, recast_step = records[0].plan[1], records[0].plan[2]
    assert (prompt_step.learner_span, prompt_step.corrected_span) == ("una cornetto", "un cornetto")
    # no gold on the repair-fail turn: the recast supplies it
    assert (recast_step.learner_span, recast_step.corrected_span) == ("Una cornetto", "un cornetto")
    assert records[0].plan[0].corrected_span is None


def test_bench_sets_need_eval_scenarios_and_gold(tmp_path: Path) -> None:
    src = _write(tmp_path, BENCH)
    records, problems = compile_set("t", grammar=NullChecker(), source_dir=src, split="eval")
    assert problems == []
    (record,) = records
    assert record.split == "eval" and record.filter is not None and record.filter.passed
    assert record.plan[0].corrected_span == "Un cono"
    no_gold = BENCH.replace("      gold: {text: Una cono, fix: Un cono}\n", "")
    (tmp_path / "src" / "t" / "d.yaml").write_text(no_gold, encoding="utf-8")
    _, problems = compile_set("t", grammar=NullChecker(), source_dir=src, split="eval")
    assert "needs gold" in problems[0]
    (tmp_path / "src" / "t" / "d.yaml").write_text(GOOD, encoding="utf-8")
    _, problems = compile_set("t", grammar=NullChecker(), source_dir=src, split="eval")
    assert "training scenario" in problems[0]


def test_bench_build_is_never_loaded_for_training(tmp_path: Path) -> None:
    src = _write(tmp_path, BENCH)
    out = ["--source-dir", str(src), "--out-dir", str(tmp_path)]
    assert main(["build", "t", "--bench", "--no-languagetool", *out]) == 0
    assert load_handwritten([tmp_path / "t.jsonl"]) == []
