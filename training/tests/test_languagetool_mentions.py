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
    ],
)
def test_mentions_loanwords_and_idioms_are_dropped(text: str, word: str, rule: str) -> None:
    assert _kept(text, word, rule) == []


@pytest.mark.parametrize(
    ("text", "word", "rule"),
    [
        ("Ieri ho prenduto il treno.", "prenduto", "MORFOLOGIK_RULE_IT_IT"),
        ("Il il treno parte.", "Il il", "ITALIAN_WORD_REPEAT_RULE"),
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
