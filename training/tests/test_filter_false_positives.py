"""Filter false positives found while writing A1 dialogues: Italian words in the English list,
verb forms read as nouns, and names flagged as misspellings."""

from __future__ import annotations

import pytest

from datagen.filters import english_ratio
from datagen.languagetool import parse_matches
from datagen.lemmas import (
    BandChecker,
    SimplemmaLemmatizer,
    default_lemma_list,
    is_number_word,
    verb_guesses,
)
from spec.levels import Level, band_for


@pytest.fixture(scope="module")
def checker() -> BandChecker:
    return BandChecker(default_lemma_list(), SimplemmaLemmatizer())


@pytest.mark.parametrize("reply", ["Cosa ti do oggi?", "Anche a me!", "Do un caffè a me."])
def test_italian_homographs_are_not_english(reply: str) -> None:
    assert english_ratio(reply, allow_brackets=False) == 0.0


def test_english_is_still_caught() -> None:
    assert english_ratio("What do you want to eat?", allow_brackets=False) >= 0.5


@pytest.mark.parametrize(
    ("form", "infinitive"),
    [
        ("paga", "pagare"),
        ("paghi", "pagare"),
        ("usa", "usare"),
        ("usi", "usare"),
        ("sveglio", "svegliare"),
        ("svegli", "svegliare"),
        ("studi", "studiare"),
        ("studiamo", "studiare"),
        ("cerchi", "cercare"),
        ("capisci", "capire"),
        ("prendono", "prendere"),
    ],
)
def test_verb_forms_reach_their_infinitive(form: str, infinitive: str) -> None:
    assert infinitive in verb_guesses(form)
    assert infinitive in SimplemmaLemmatizer().lemmas(form)


@pytest.mark.parametrize(
    "reply",
    ["Paga con la carta?", "Usi il telefono?", "La mattina studi?", "Usa la macchina."],
)
def test_common_verb_forms_are_in_band_at_a1(reply: str, checker: BandChecker) -> None:
    assert checker.check(reply, band_for(Level.A1)).out_of_band == []


def test_reflexive_key_vocab_covers_its_forms(checker: BandChecker) -> None:
    report = checker.check(
        "Ti svegli presto? Io mi sveglio alle sette.", band_for(Level.A1), allowed=["svegliarsi"]
    )
    assert report.out_of_band == []


@pytest.mark.parametrize(
    ("noun", "verb"),
    [("riparazione", "riparare"), ("spedizione", "spedire"), ("spedizioni", "spedire")],
)
def test_action_nouns_reach_their_verb(noun: str, verb: str, checker: BandChecker) -> None:
    assert verb in SimplemmaLemmatizer().lemmas(noun)
    report = checker.check(f"La {noun} costa poco.", band_for(Level.B1), allowed=[verb])
    assert report.out_of_band == []


@pytest.mark.parametrize(
    "reply",
    [
        "Attenzione: casa è femminile, quindi la casa.",
        "Il verbo va al plurale.",
        "Corretto! Hai detto tutto correttamente.",
    ],
)
def test_grammar_terms_and_praise_are_a1(reply: str, checker: BandChecker) -> None:
    assert checker.check(reply, band_for(Level.A1)).out_of_band == []


@pytest.mark.parametrize(
    "reply",
    [
        "Puoi farle una domanda.",
        "Posso darti il menù?",
        "Dimmi tutto. Fammi vedere.",
        "Ci vediamo a gennaio o a marzo.",
        "Ho trentacinque anni, lui ne ha ventitré.",
        "C'è tanta gente.",
    ],
)
def test_clitics_imperatives_months_and_numbers_are_a1(reply: str, checker: BandChecker) -> None:
    assert checker.check(reply, band_for(Level.A1)).out_of_band == []


@pytest.mark.parametrize("word", ["trentacinque", "duemila", "centoventi", "ventitré", "diciotto"])
def test_number_words(word: str) -> None:
    assert is_number_word(word)


@pytest.mark.parametrize("word", ["", "tremare", "settimana", "novità", "centro"])
def test_not_number_words(word: str) -> None:
    assert not is_number_word(word)


@pytest.mark.parametrize(
    ("reply", "level"),
    [
        ("Buon appetito! Il parco è aperto.", Level.A1),
        ("È al terzo piano. Il pesce è fresco.", Level.A1),
        ("Il frigorifero e la lavatrice sono nel soggiorno?", Level.A2),
        ("L'affitto mensile è di 600 euro, con le bollette.", Level.A2),
        ("Compili il modulo, per favore. Il totale è 20 euro.", Level.A2),
        ("Ci sono latticini?", Level.A2),
        ("Di che nazionalità sei? Sei francese o spagnola? Vivo in città con mia nonna.", Level.A1),
        ("Oggi piove e c'è vento. Prendo la giacca e i pantaloni.", Level.A2),
        ("Una camera singola o doppia? Ecco il passaporto e la valigia.", Level.A2),
    ],
)
def test_round_one_scenario_words(reply: str, level: Level, checker: BandChecker) -> None:
    assert checker.check(reply, band_for(level)).out_of_band == []


def test_misconjugations_are_not_read_as_verbs(checker: BandChecker) -> None:
    assert [o.token for o in checker.check("Non sapo?", band_for(Level.A1)).out_of_band] == ["sapo"]


def test_rare_words_stay_out_of_band(checker: BandChecker) -> None:
    report = checker.check("Il condominio ha un ascensore.", band_for(Level.A1))
    assert {o.token for o in report.out_of_band} == {"condominio", "ascensore"}


def _typo(offset: int, length: int) -> dict[str, object]:
    return {
        "message": "Possibile errore di ortografia",
        "offset": offset,
        "length": length,
        "rule": {
            "id": "MORFOLOGIK_RULE_IT_IT",
            "category": {"id": "TYPOS"},
            "issueType": "misspelling",
        },
    }


def test_names_are_not_misspellings() -> None:
    text = "Piacere, sono la signora Murphy e lui è Miller. Questo è García. Ho fame tantto."
    spans = [(text.index(w), len(w)) for w in ("Murphy", "Miller", "García", "tantto")]
    payload = {"matches": [_typo(o, n) for o, n in spans]}
    assert [m.span(text) for m in parse_matches(payload, text=text)] == ["tantto"]
    assert len(parse_matches(payload)) == 4  # without the text nothing is dropped


def test_shouted_misspelling_is_still_checked() -> None:
    text = "CIAOO!"
    assert len(parse_matches({"matches": [_typo(0, 5)]}, text=text)) == 1
