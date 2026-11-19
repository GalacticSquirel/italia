from __future__ import annotations

import json
from pathlib import Path

import pytest

from datagen.handwritten import compile_set
from datagen.handwritten import main as handwritten_main
from datagen.languagetool import GrammarMatch, NullChecker
from datagen.lemmas import BandChecker, SimplemmaLemmatizer, default_lemma_list
from datagen.teacher import ScriptedClient
from eval.__main__ import load_items
from eval.__main__ import main as eval_main
from eval.items import EvalItem, Gold, build_items
from eval.metrics import _fixes_gold, _tag_matches, prf, score_system, tag_scores
from eval.pairwise import compare, wilson_interval, win_rate_from_scores
from eval.predict import (
    SystemSpec,
    load_predictions,
    load_systems,
    predict,
    reference_predictions,
    request_endpoint,
)
from eval.report import parse_llama_bench, render_report
from spec.levels import Level
from tests.helpers import make_record, output
from tests.test_handwritten import BENCH

CHECKER = BandChecker(default_lemma_list(), SimplemmaLemmatizer())
ROOT = Path(__file__).resolve().parents[1]


def eval_items() -> list[EvalItem]:
    records = [make_record("gelateria", Level.A1, seed=s) for s in range(6)]
    records += [make_record("oggetti-smarriti", Level.A2, seed=s) for s in range(6)]
    return build_items(records)


def score(preds: dict[str, str], items: list[EvalItem]) -> dict[str, float]:
    return score_system("s", items, preds, band_checker=CHECKER, grammar=NullChecker()).summary()


def test_items_come_only_from_eval_dialogues() -> None:
    items = eval_items()
    assert items and all(i.messages[-1]["role"] == "user" for i in items)
    assert all(i.learner_text == i.messages[-1]["content"] for i in items)
    with pytest.raises(ValueError, match="not from an eval scenario"):
        build_items([make_record("weekend-scorso")])
    assert len(build_items([make_record("gelateria", Level.A1)], max_per_dialogue=1)) == 1


def test_reference_scores_perfectly_on_policy_metrics() -> None:
    items = eval_items()
    summary = score(reference_predictions(items), items)
    assert summary["json_validity"] == 1.0
    assert summary["move_accuracy"] == 1.0
    assert summary["over_correction"] == 0.0 and summary["under_correction"] == 0.0
    assert summary["annotation_consistency"] == 1.0
    if any(i.gold.tags for i in items):
        assert summary["tag_f1_micro"] == 1.0


def test_over_correction_and_invalid_output_are_penalised() -> None:
    items = eval_items()
    always_prompt = output("Sei sicuro?", prompt=("Ieri", ["spelling"])).to_json()
    preds = {i.id: always_prompt for i in items}
    preds[items[0].id] = "not json"
    summary = score(preds, items)
    assert summary["json_validity"] == pytest.approx((len(items) - 1) / len(items))
    assert summary["over_correction"] == 1.0
    assert summary["move_accuracy"] < 1.0
    assert summary["tag_precision_micro"] == 0.0


def test_recast_correctness_requires_matching_correction() -> None:
    items = [i for i in eval_items() if i.gold.expected_move == "recast"]
    if not items:
        pytest.skip("no recast items in this sample")
    tag = items[0].gold.target_tag
    assert tag is not None
    wrong = output("Ah, siamo andati!", recast=("ho andato", "siamo andati", [tag])).to_json()
    good = reference_predictions(items)
    assert score(good, items)["recast_correctness"] == 1.0
    assert score({i.id: wrong for i in items}, items)["recast_correctness"] == 0.0


def test_tag_scores_math() -> None:
    gold = [{"a"}, {"b"}, set(), {"a"}]
    pred = [{"a"}, {"a"}, {"c"}, set()]
    micro, macro, per_tag = tag_scores(gold, pred)
    assert micro == prf(1, 2, 2)
    assert per_tag["a"].precision == 0.5 and per_tag["a"].recall == 0.5
    assert per_tag["b"].recall == 0.0
    assert macro.support == 3
    assert prf(0, 0, 0).f1 == 0.0


def test_predict_is_resumable_and_constrained(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    items = eval_items()[:5]
    spec = SystemSpec.model_validate(
        {
            "name": "student",
            "constrained": True,
            "systemRole": "merge",
            "endpoint": {"protocol": "openai", "baseUrl": "http://x", "model": "m"},
        }
    )
    extra = request_endpoint(spec).extra_body["response_format"]
    assert extra["type"] == "json_schema"  # type: ignore[index]
    client = ScriptedClient([output("Bene!").to_json()])
    out = tmp_path / "preds.jsonl"
    ticks = iter(range(100))
    assert predict(spec, items, out, client=client, clock=lambda: float(next(ticks))) == 5
    assert client.calls[0][0]["role"] == "user"  # system prompt merged into the first turn
    assert predict(spec, items, out, client=client) == 0
    preds = load_predictions(out, "student")
    assert set(preds) == {i.id for i in items}
    monkeypatch.setenv("TEACHER_MODEL", "t")
    systems = load_systems(ROOT / "eval" / "configs" / "systems.yaml")
    assert {"student-q4", "base", "teacher"} <= set(systems)
    assert systems["student-q4"].constrained


def test_pairwise_and_wilson() -> None:
    low, high = wilson_interval(50, 100)
    assert low < 0.5 < high and high - low < 0.21
    assert wilson_interval(0, 0) == (0.0, 1.0)
    assert win_rate_from_scores("a", "b", [1, 1, 0, 0.5]).win_rate == pytest.approx(0.625)
    items = eval_items()[:4]
    ours = {i.id: "A-text" for i in items}
    theirs = {i.id: "B-text" for i in items}

    def judge(messages: object) -> str:
        content = messages[0]["content"]  # type: ignore[index]
        first = content.split("<A>")[1].split("</A>")[0].strip()
        return json.dumps({"winner": "A" if first == "A-text" else "B"})

    result = compare("ours", "theirs", items, ours, theirs, judge=ScriptedClient(judge), workers=1)
    assert result.comparisons == 4 and result.win_rate == 1.0 and result.failed == 0


def test_report_and_bench() -> None:
    items = eval_items()
    scores = [
        score_system(n, items, p, band_checker=CHECKER, grammar=NullChecker())
        for n, p in [("teacher-reference", reference_predictions(items)), ("student", {})]
    ]
    bench = parse_llama_bench(
        json.dumps(
            [
                {
                    "model_filename": "/x/italia-tutor-e4b-q4_0.gguf",
                    "n_prompt": 1024,
                    "n_gen": 0,
                    "avg_ts": 180.5,
                    "n_threads": 6,
                },
                {
                    "model_filename": "/x/italia-tutor-e4b-q4_0.gguf",
                    "n_prompt": 0,
                    "n_gen": 128,
                    "avg_ts": 11.2,
                    "n_threads": 6,
                },
            ]
        ),
        "pixel9",
    )
    assert [b.test for b in bench] == ["pp1024", "tg128"]
    win = win_rate_from_scores("student", "teacher-reference", [1, 0, 0.5])
    text = render_report("Eval", scores, [win], bench, notes=["n"])
    for heading in (
        "## Automatic metrics",
        "## By level",
        "## Feedback moves",
        "## Judge pairwise win rates",
        "## On-device speed",
        "pixel9",
    ):
        assert heading in text
    assert "| JSON validity (higher is better) | **100.0%** | 0.0% |" in text


def bench_items(tmp_path: Path) -> list[EvalItem]:
    folder = tmp_path / "src" / "b"
    folder.mkdir(parents=True)
    (folder / "d.yaml").write_text(BENCH, encoding="utf-8")
    records, _ = compile_set("b", grammar=NullChecker(), source_dir=tmp_path / "src", split="eval")
    return build_items(records)


def test_bench_items_carry_gold_spans_and_score_leaks(tmp_path: Path) -> None:
    items = bench_items(tmp_path)
    first = items[0]
    assert first.gold.expected_move == "prompt"
    assert (first.gold.learner_span, first.gold.corrected_span) == ("Una cono", "Un cono")
    reference = score(reference_predictions(items), items)
    assert reference["prompt_leak_rate"] == 0.0
    assert reference["correction_accuracy"] == 1.0
    leak = output("Un cono, non una cono!", prompt=("Una cono", ["noun-gender"])).to_json()
    wrong_tag = output("Sei sicuro?", prompt=("Una cono", ["spelling"])).to_json()
    for pred, leak_rate, accuracy in ((leak, 1.0, 1.0), (wrong_tag, 0.0, 0.0)):
        summary = score({**reference_predictions(items), first.id: pred}, items)
        assert summary["prompt_leak_rate"] == leak_rate
        assert summary["correction_accuracy"] == accuracy


def test_build_items_from_bench_records(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    folder = tmp_path / "src" / "b"
    folder.mkdir(parents=True)
    (folder / "d.yaml").write_text(BENCH, encoding="utf-8")
    out = ["--source-dir", str(tmp_path / "src"), "--out-dir", str(tmp_path)]
    assert handwritten_main(["build", "b", "--bench", "--no-languagetool", *out]) == 0
    monkeypatch.chdir(tmp_path)
    assert eval_main(["build-items", "--records", "*.jsonl", "--out", "items.jsonl"]) == 0
    assert len(load_items(tmp_path / "items.jsonl")) == 4


def test_report_parity_against_the_reference(tmp_path: Path) -> None:
    items = bench_items(tmp_path)
    scores = [
        score_system(n, items, p, band_checker=CHECKER, grammar=NullChecker())
        for n, p in [
            ("teacher-reference", reference_predictions(items)),
            ("twin", reference_predictions(items)),
            ("student", {}),
        ]
    ]
    win = win_rate_from_scores("twin", "teacher-reference", [1, 0, 0.5, 0.5])
    text = render_report("Eval", scores, [win], reference="teacher-reference")
    assert "## Parity with the reference (teacher-reference)" in text
    assert "twin: 10/10 on par (parity reached)" in text
    assert "student: " in text and "student: 10/10" not in text


@pytest.mark.parametrize(
    ("gold", "recast", "ok"),
    [
        # Right fixes whose span or person differs from the gold.
        (("Hai qualcosa", "Ha qualcosa"), ("Hai", "Ha"), True),
        (("No mi piace", "Non mi piace"), ("No mi piace", "Non le piace"), True),
        (
            ("Le avevo controllato", "Le avevo controllate"),
            ("Le avevo controllato", "Le aveva controllate"),
            True,
        ),
        (
            ("Meno molesto come quello", "Meno molesto di quello"),
            ("molesto come quello", "molesto di quello"),
            True,
        ),
        (("molto demandante", "molto esigente"), ("demandante", "esigente"), True),
        # Dodges and wrong fixes.
        (("Quanti costa", "Quanto costa"), ("Quanti costa", "Il giornale costa"), False),
        (("venirà", "verrà"), ("venirà", "arriverà"), False),
        (("il mobile", "il cellulare"), ("il mobile", "Il portafoglio"), False),
        (("due magazzini", "due riviste"), ("di mia sorella", "di sua sorella"), False),
    ],
)
def test_recast_accepts_the_gold_fix_in_any_span(
    gold: tuple[str, str], recast: tuple[str, str], ok: bool
) -> None:
    g = Gold(
        expected_move="recast",
        target_tag="word-choice",
        learner_span=gold[0],
        corrected_span=gold[1],
    )
    assert _fixes_gold(recast[0], recast[1], g) is ok


def test_lexical_tags_count_as_one_family_for_corrections() -> None:
    assert _tag_matches("false-friend", ["word-choice"])
    assert _tag_matches("word-choice", ["false-friend", "spelling"])
    assert _tag_matches("preposition", ["preposition"])
    assert not _tag_matches("preposition", ["articulated-preposition"])
    assert not _tag_matches("false-friend", ["spelling"])


class _WordChecker:
    """Flags every occurrence of the given words."""

    def __init__(self, *words: str) -> None:
        self.words = words

    def check(self, text: str) -> list[GrammarMatch]:
        out = []
        for w in self.words:
            at = text.find(w)
            if at >= 0:
                out.append(GrammarMatch(f"RULE_{w.upper()}", "GRAMMAR", "", at, len(w)))
        return out


def test_lt_metric_drops_learner_echoes_and_counts_rules() -> None:
    items = eval_items()[:1]
    item = items[0]
    echoed = item.learner_text.split()[0].strip(".,!?")
    preds = {item.id: output(f"{echoed} zzerrore, bene.").to_json()}
    scores = score_system(
        "s", items, preds, band_checker=CHECKER, grammar=_WordChecker(echoed, "zzerrore")
    )
    assert scores.lt_errors == 1 and scores.replies_with_lt_error == 1
    assert scores.lt_rules == {"RULE_ZZERRORE": 1}
    text = render_report("Eval", [scores])
    assert "## LanguageTool rules in replies" in text and "RULE_ZZERRORE 1" in text
