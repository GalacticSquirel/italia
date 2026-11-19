"""LanguageTool matches on mentions, loanwords, reduplication and learner echoes are not errors
(found by rebuilding the hand-written dialogue sets with LanguageTool)."""

from __future__ import annotations

import pytest

from datagen.languagetool import GrammarMatch, errors_per_100_words, parse_matches
from datagen.quotes import quoted_regions


def _match(text: str, word: str, rule: str = "MORFOLOGIK_RULE_IT_IT") -> dict[str, object]:
    typo = rule.startswith("MORFOLOGIK")
    return {
        "message": "...",
        "offset": text.index(word),
        "length": len(word),
        "rule": {
            "id": rule,
            "category": {"id": "TYPOS" if typo else "GRAMMAR"},
            "issueType": "misspelling" if typo else "grammar",
        },
    }


def _kept(text: str, word: str, rule: str = "MORFOLOGIK_RULE_IT_IT") -> list[str]:
    return [m.span(text) for m in parse_matches({"matches": [_match(text, word, rule)]}, text=text)]


@pytest.mark.parametrize(
    ("text", "word", "rule"),
    [
        ("Ho «prenduto»? Prendere al passato è speciale.", "prenduto", "MORFOLOGIK_RULE_IT_IT"),
        ('Ma "vadi" non è la forma giusta.', "vadi", "MORFOLOGIK_RULE_IT_IT"),
        ("Scusi, 'il lunedì'? Parte tutti i lunedì?", "lunedì'", "GR_04_002"),
        ("Però «prima che Lei firma»... dopo «prima che» ci vuole...", "firma", "GR_10_003"),
        ("Avete già un'idea del budget?", "budget", "MORFOLOGIK_RULE_IT_IT"),
        ("Avete già un'idea del budget?", "budget", "ST_01_005"),
        ("Yoga il martedì, pilates il venerdì.", "pilates", "MORFOLOGIK_RULE_IT_IT"),
        ("Quasi quasi lo propongo anche io.", "Quasi quasi", "ITALIAN_WORD_REPEAT_RULE"),
        ("Questa parola finisce in -a, ma è un po' speciale.", "-a", "MORFOLOGIK_RULE_IT_IT"),
        ("Questa parola finisce in -a, ma è un po' speciale.", "a,", "MORFOLOGIK_RULE_IT_IT"),
        ("Vogliamo fare le cose senza badare a spese.", "a spese", "ER_01_001"),
        ("Un finale a sorpresa, ottimo.", "a sorpresa", "ER_01_001"),
        ("Manca un pronome piccolo piccolo.", "piccolo piccolo", "ITALIAN_WORD_REPEAT_RULE"),
        ("Ah ah, due giorni a casa!", "Ah ah", "ITALIAN_WORD_REPEAT_RULE"),
        ("Ci sono due secondi vegani, senza carne.", "vegani", "MORFOLOGIK_RULE_IT_IT"),
        ("Un libro bello, a tratti difficile.", "a tratti", "ER_01_001"),
        ("Ci vediamo nello showroom.", "showroom", "MORFOLOGIK_RULE_IT_IT"),
        ("Serve un business plan serio.", "business plan", "MORFOLOGIK_RULE_IT_IT"),
        ("Facciamo una videochiamata domani.", "videochiamata", "MORFOLOGIK_RULE_IT_IT"),
        ("Domani ho una videolezione.", "videolezione", "MORFOLOGIK_RULE_IT_IT"),
        ("Lavoro part-time.", "part-time", "MORFOLOGIK_RULE_IT_IT"),
        ("Faccio mea culpa.", "mea", "MORFOLOGIK_RULE_IT_IT"),
        ("Uno spritz, grazie.", "spritz", "MORFOLOGIK_RULE_IT_IT"),
        ("Mi manda il report?", "report", "MORFOLOGIK_RULE_IT_IT"),
        ("Ascolta solo rap.", "rap", "MORFOLOGIK_RULE_IT_IT"),
        ("Una poesia montaliana.", "montaliana", "MORFOLOGIK_RULE_IT_IT"),
        ("Una pizza ai quattro formaggi.", "ai", "ER_01_002"),
        ("La fermata è vicino ai taxi.", "ai", "ER_01_002"),
        ("Si gioca a porte chiuse.", "a porte", "ER_01_001"),
        ("Parliamone a quattr'occhi.", "quattr'", "MORFOLOGIK_RULE_IT_IT"),
        ("Un accento inglesissimo.", "inglesissimo", "MORFOLOGIK_RULE_IT_IT"),
        ("Una donna saggissima.", "saggissima", "MORFOLOGIK_RULE_IT_IT"),
        ("Sono ricchissimi.", "ricchissimi", "MORFOLOGIK_RULE_IT_IT"),
    ],
)
def test_mentions_loanwords_and_idioms_are_dropped(text: str, word: str, rule: str) -> None:
    assert _kept(text, word, rule) == []


@pytest.mark.parametrize(
    ("text", "word", "rule"),
    [
        ("Ieri ho prenduto il treno.", "prenduto", "MORFOLOGIK_RULE_IT_IT"),
        ("Il il treno parte.", "Il il", "ITALIAN_WORD_REPEAT_RULE"),
        ("Lui a mangiato tutto.", "a mangiato", "ER_01_001"),
        ("Tu ai fame?", "ai", "ER_01_002"),
        ("Un vestito bellisimo.", "bellisimo", "MORFOLOGIK_RULE_IT_IT"),
        ("Un posto blarghissimo.", "blarghissimo", "MORFOLOGIK_RULE_IT_IT"),
        ("Bisogna che lei viene, l'ho detto.", "viene", "GR_10_003"),
    ],
)
def test_real_errors_outside_quotes_are_kept(text: str, word: str, rule: str) -> None:
    assert _kept(text, word, rule) == [word]


def test_elisions_are_not_quotes() -> None:
    text = "L'albergo è bello, l'ho visto e c'è un'idea."
    assert quoted_regions(text) == []


class _Fixed:
    def __init__(self, word: str) -> None:
        self.word = word

    def check(self, text: str) -> list[GrammarMatch]:
        i = text.find(self.word)
        return (
            [] if i < 0 else [GrammarMatch("MORFOLOGIK_RULE_IT_IT", "TYPOS", "", i, len(self.word))]
        )


def test_echo_of_the_learner_turn_is_not_an_error() -> None:
    reply = "Ha prenduto il treno? Prendere al passato è speciale."
    checker = _Fixed("prenduto")
    assert errors_per_100_words(checker, [reply]) > 0
    assert errors_per_100_words(checker, [reply], ["Ieri ho prenduto il treno."]) == 0
    assert errors_per_100_words(checker, [reply], ["Ieri ho preso il treno."]) > 0
