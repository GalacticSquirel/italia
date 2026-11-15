from __future__ import annotations

from datagen.config import FilterConfig
from datagen.dedupe import find_duplicates, shingles
from datagen.filters import (
    english_ratio,
    filter_dialogue,
    parse_tutor_output,
    policy_agreement,
    summarize,
)
from datagen.languagetool import GrammarMatch, NullChecker
from datagen.lemmas import BandChecker, SimplemmaLemmatizer, default_lemma_list
from datagen.records import DialogueRecord
from spec.models import Turn
from tests.helpers import make_record, output

CHECKER = BandChecker(default_lemma_list(), SimplemmaLemmatizer())


def run(record: DialogueRecord, grammar: object = None, **cfg: float) -> list[str]:
    result = filter_dialogue(
        record,
        band_checker=CHECKER,
        grammar=grammar or NullChecker(),  # type: ignore[arg-type]
        config=FilterConfig(**cfg),  # type: ignore[arg-type]
    )
    return result.reasons


def replace_tutor(record: DialogueRecord, index: int, new: Turn) -> DialogueRecord:
    turns = list(record.turns)
    turns[index] = new
    return record.model_copy(update={"turns": turns})


def first_corrected_index(record: DialogueRecord) -> int:
    for i, t in enumerate(record.turns):
        if t.output is not None and t.output.annotations.move != "none":
            return i
    raise AssertionError("no correction in record")


def test_plan_following_dialogue_passes() -> None:
    record = make_record()
    assert run(record) == []
    assert policy_agreement(record)[0] == 1.0


def test_over_correction_breaks_policy_agreement() -> None:
    record = make_record()
    clean = next(
        i
        for i, t in enumerate(record.turns)
        if i > 0 and t.output is not None and t.output.annotations.move == "none"
    )
    bad = replace_tutor(
        record,
        clean,
        Turn.tutor(
            output("Sei andato? E poi?", recast=("al bar", "a il bar", ["articulated-preposition"]))
        ),
    )
    reasons = run(bad, min_policy_agreement=1.0)
    assert any("policy agreement" in r for r in reasons)


def test_learner_text_must_come_from_learner_turn() -> None:
    record = make_record()
    i = first_corrected_index(record)
    tag = record.turns[i].output.annotations.error_tags[0]  # type: ignore[union-attr]
    bad = replace_tutor(record, i, Turn.tutor(output("Hai sbagliato?", prompt=("xyz", [tag]))))
    assert any("learnerText not found" in r for r in run(bad))


def test_out_of_band_and_long_sentences_fail() -> None:
    record = make_record()
    bad = replace_tutor(
        record,
        0,
        Turn.tutor(
            output(
                "Mi rincresce, la caparra comprende due mensilità anticipate e il "
                "condominio, nonché le spese straordinarie che il proprietario sostiene "
                "ogni anno per l'edificio."
            )
        ),
    )
    reasons = run(bad)
    assert any("out of band" in r for r in reasons)
    assert any("sentence too long" in r for r in reasons)


def test_unknown_goal_and_english_fail() -> None:
    record = make_record()
    bad = replace_tutor(record, 0, Turn.tutor(output("Hello, what do you want?", goals=["nope"])))
    reasons = run(bad)
    assert any("unknown goal ids" in r for r in reasons)
    assert any("not in Italian" in r for r in reasons)
    assert english_ratio("Ciao (hello)!", allow_brackets=True) == 0


class FlagEverything:
    def check(self, text: str) -> list[GrammarMatch]:
        return [GrammarMatch("X", "GRAMMAR", "bad", 0, 1)]


def test_languagetool_errors_fail() -> None:
    reasons = run(make_record(), grammar=FlagEverything())
    assert any("LanguageTool" in r for r in reasons)


def test_parse_tutor_output_is_strict() -> None:
    good = output("Ciao!").to_json()
    assert parse_tutor_output(good)[0] is not None
    assert parse_tutor_output("```json\n" + good + "\n```")[0] is None
    assert parse_tutor_output('{"reply": "x"}')[1]
    assert parse_tutor_output("{")[1][0].startswith("invalid JSON")


def test_summarize_counts_reason_kinds() -> None:
    from datagen.records import FilterResult

    counts = summarize(
        [
            FilterResult(
                passed=False,
                reasons=["turn 2: out of band (20%): x", "turn 4: out of band (9%): y"],
            ),
            FilterResult(passed=False, reasons=["near-duplicate"]),
        ]
    )
    assert counts == {"out of band": 1, "near-duplicate": 1}


def test_dedupe_exact_and_near() -> None:
    base = (
        "Buongiorno! Cosa prende oggi? Un caffè e un cornetto, grazie. Vuole lo zucchero? "
        "Sì, un po' di zucchero, per favore. Il cornetto è alla crema o alla marmellata? "
        "Alla crema, grazie. Prende anche un bicchiere d'acqua? No, grazie, va bene così. "
        "Ecco a lei. Quanto costa? Due euro e cinquanta. Grazie, buona giornata!"
    )
    texts = {
        "a": base,
        "b": base.upper(),  # exact after normalisation
        "c": base.replace("cinquanta", "trenta"),  # near-duplicate
        "d": "Ciao Marco! Com'è andato il fine settimana? Sono andato al mare con mia sorella.",
    }
    dropped = find_duplicates(texts, threshold=0.7)
    assert dropped == {"b", "c"}
    assert shingles("uno due") == {"uno due"}
