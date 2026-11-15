"""CEFR level bands: how hard the tutor's Italian may be at each level.

A band is the contract the tutor's replies are checked against (by the data filters, the
evaluation and, at runtime, by the app's guard rails). The lemma ceiling is a frequency rank in the
seed lemma list (`data/lemmas.seed-v1.tsv`): at A1 the tutor may use the 500 most frequent lemmas,
plus closed-class words, the scenario's key vocabulary, and at most `max_new_words` new words that
it declares in `annotations.newWords`.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class Level(StrEnum):
    """CEFR levels the tutor supports (C1 is out of scope for v1)."""

    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"

    @property
    def rank(self) -> int:
        """1 for A1 up to 4 for B2, for ordering comparisons."""
        return _RANK[self]

    def at_most(self, other: Level) -> bool:
        """True when this level is the same as or below `other`."""
        return self.rank <= other.rank


_RANK = {Level.A1: 1, Level.A2: 2, Level.B1: 3, Level.B2: 4}


@dataclass(frozen=True)
class LevelBand:
    """Limits for tutor replies at one level."""

    level: Level
    lemma_ceiling: int
    """Default known-lemma ceiling (frequency rank); a learner's own ceiling may override it."""
    max_words_per_sentence: int
    max_sentences: int
    max_new_words: int
    """New lemmas above the ceiling the tutor may introduce per reply (declared in newWords)."""
    max_out_of_band_ratio: float
    """Share of content tokens allowed outside the band (after allowed extras), per reply."""
    english_allowed: bool
    """Whether a short English gloss in brackets is acceptable (A1 only)."""


BANDS: dict[Level, LevelBand] = {
    Level.A1: LevelBand(Level.A1, 500, 8, 2, 1, 0.05, english_allowed=True),
    Level.A2: LevelBand(Level.A2, 1000, 12, 3, 1, 0.05, english_allowed=False),
    Level.B1: LevelBand(Level.B1, 2000, 18, 4, 2, 0.08, english_allowed=False),
    Level.B2: LevelBand(Level.B2, 3000, 25, 5, 2, 0.10, english_allowed=False),
}


def band_for(level: Level, lemma_ceiling: int | None = None) -> LevelBand:
    """The band for `level`, with the learner's own lemma ceiling if given."""
    band = BANDS[level]
    if lemma_ceiling is None or lemma_ceiling == band.lemma_ceiling:
        return band
    if lemma_ceiling < 1:
        raise ValueError("lemma_ceiling must be positive")
    return LevelBand(
        level=band.level,
        lemma_ceiling=lemma_ceiling,
        max_words_per_sentence=band.max_words_per_sentence,
        max_sentences=band.max_sentences,
        max_new_words=band.max_new_words,
        max_out_of_band_ratio=band.max_out_of_band_ratio,
        english_allowed=band.english_allowed,
    )
