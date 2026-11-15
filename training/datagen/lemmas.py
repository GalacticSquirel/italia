"""Italian tokenising, lemmatising and the vocabulary-band checker.

The band checker answers: which words in a tutor reply are outside what a learner at this level
knows? A content token is in band when its lemma's frequency rank in the seed lemma list is at or
below the band's ceiling, or it is a closed-class word, a number, a proper noun, part of the
scenario's key vocabulary, or a new word the reply declared in `newWords`.
"""

from __future__ import annotations

import csv
import json
import re
import unicodedata
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from functools import cache
from pathlib import Path
from typing import Protocol

from spec.levels import LevelBand

TRAINING_DIR = Path(__file__).resolve().parents[1]
DEFAULT_LEMMA_FILE = TRAINING_DIR / "data" / "lemmas.seed-v1.tsv"
DEFAULT_CORE_VOCAB_FILE = TRAINING_DIR / "data" / "core_vocab.tsv"

# A core-vocabulary lemma listed at level L gets this effective rank: inside L's band ceiling.
_CORE_RANK = {"A1": 1, "A2": 501, "B1": 1001, "B2": 2001}

# Irregular forms the dictionary lemmatiser gets wrong or misses.
IRREGULAR_FORMS = {
    "vai": "andare",
    "va": "andare",
    "vanno": "andare",
    "vado": "andare",
    "detto": "dire",
    "detta": "dire",
    "detti": "dire",
    "dette": "dire",
    "successo": "succedere",
    "successa": "succedere",
    "successi": "succedere",
    "stato": "essere",
    "stata": "essere",
    "stati": "essere",
    "state": "essere",
    "perso": "perdere",
    "persa": "perdere",
    "persi": "perdere",
    "perse": "perdere",
    "po": "poco",
}
_SUPERLATIVE = re.compile(r"^(.{3,})issim[oaie]$")

_WORD = re.compile(r"[A-Za-zÀ-ÖØ-öø-ÿ]+(?:['\u2019][A-Za-zÀ-ÖØ-öø-ÿ]+)*|\d+(?:[.,]\d+)*")
_ELISION = re.compile(r"^([A-Za-zÀ-ÖØ-öø-ÿ]+)['\u2019]([A-Za-zÀ-ÖØ-öø-ÿ]+)$")
_SENTENCE_END = re.compile(r"(?<=[.!?…])\s+")

# Closed-class words are always in band: articles, prepositions (simple and articulated),
# pronouns and clitics, conjunctions, common determiners and a few discourse particles.
CLOSED_CLASS = frozenset(
    [
        "il",
        "lo",
        "la",
        "i",
        "gli",
        "le",
        "l",
        "un",
        "uno",
        "una",
        "un'",
        "del",
        "dello",
        "della",
        "dei",
        "degli",
        "delle",
        "dell",
        "al",
        "allo",
        "alla",
        "ai",
        "agli",
        "alle",
        "all",
        "dal",
        "dallo",
        "dalla",
        "dai",
        "dagli",
        "dalle",
        "dall",
        "nel",
        "nello",
        "nella",
        "nei",
        "negli",
        "nelle",
        "nell",
        "sul",
        "sullo",
        "sulla",
        "sui",
        "sugli",
        "sulle",
        "sull",
        "col",
        "coi",
        "di",
        "a",
        "da",
        "in",
        "con",
        "su",
        "per",
        "tra",
        "fra",
        "io",
        "tu",
        "lui",
        "lei",
        "noi",
        "voi",
        "loro",
        "egli",
        "ella",
        "esso",
        "essa",
        "essi",
        "esse",
        "me",
        "te",
        "sé",
        "mi",
        "ti",
        "si",
        "ci",
        "vi",
        "ne",
        "mio",
        "mia",
        "miei",
        "mie",
        "tuo",
        "tua",
        "tuoi",
        "tue",
        "suo",
        "sua",
        "suoi",
        "sue",
        "nostro",
        "nostra",
        "nostri",
        "nostre",
        "vostro",
        "vostra",
        "vostri",
        "vostre",
        "questo",
        "questa",
        "questi",
        "queste",
        "quello",
        "quella",
        "quelli",
        "quelle",
        "quel",
        "quei",
        "quegli",
        "che",
        "chi",
        "cui",
        "quale",
        "quali",
        "quanto",
        "quanta",
        "quanti",
        "quante",
        "come",
        "dove",
        "quando",
        "perché",
        "cosa",
        "e",
        "ed",
        "o",
        "od",
        "ma",
        "però",
        "anche",
        "se",
        "non",
        "né",
        "neanche",
        "nemmeno",
        "già",
        "più",
        "meno",
        "molto",
        "poco",
        "tanto",
        "troppo",
        "ogni",
        "qualche",
        "alcuni",
        "alcune",
        "nessuno",
        "nessuna",
        "niente",
        "nulla",
        "tutto",
        "tutta",
        "tutti",
        "tutte",
        "altro",
        "altra",
        "altri",
        "altre",
        "sì",
        "no",
        "ecco",
        "ciao",
        "grazie",
        "prego",
        "scusi",
        "scusa",
        "allora",
        "va",
        "bene",
        "beh",
        "ok",
        "c",
        "d",
        "m",
        "t",
        "s",
        "v",
        "n",
        "dov",
        "com",
        "cos",
        "quell",
        "bell",
        "buon",
        "nessun",
        "qualcun",
        "sant",
        "glielo",
        "gliela",
        "glieli",
        "gliele",
        "gliene",
        "me",
        "te",
        "ce",
        "ve",
        "se",
    ]
)

_CLITICS = (
    "glielo",
    "gliela",
    "glieli",
    "gliele",
    "gliene",
    "melo",
    "mela",
    "telo",
    "tela",
    "celo",
    "cela",
    "velo",
    "vela",
    "selo",
    "sela",
    "mene",
    "tene",
    "cene",
    "vene",
    "gli",
    "lo",
    "la",
    "li",
    "le",
    "ne",
    "mi",
    "ti",
    "ci",
    "vi",
    "si",
)


def strip_accents(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")


def tokenize(text: str) -> list[str]:
    """Word tokens; elided forms (l'acqua, c'è) are split into two tokens."""
    tokens: list[str] = []
    for match in _WORD.finditer(text):
        word = match.group(0)
        elided = _ELISION.match(word)
        if elided:
            tokens.extend((elided.group(1), elided.group(2)))
        else:
            tokens.append(word)
    return tokens


def split_sentences(text: str) -> list[str]:
    return [s for s in (p.strip() for p in _SENTENCE_END.split(text.strip())) if s]


def words_per_sentence(text: str) -> list[int]:
    return [len(tokenize(s)) for s in split_sentences(text)]


class Lemmatizer(Protocol):
    def lemmas(self, word: str) -> list[str]:
        """Candidate lemmas for a lowercase word form, most likely first."""
        ...


class SimplemmaLemmatizer:
    """Dictionary lemmatiser (simplemma, MIT) with an enclitic-pronoun fallback."""

    def lemmas(self, word: str) -> list[str]:
        import simplemma  # noqa: PLC0415 - heavy dictionary load only when used

        def lemma(w: str) -> str:
            first = simplemma.lemmatize(w, lang="it")
            return first if first == w else simplemma.lemmatize(first, lang="it")

        candidates = [word, lemma(word)]
        if word in IRREGULAR_FORMS:
            candidates.insert(1, IRREGULAR_FORMS[word])
        superlative = _SUPERLATIVE.match(word)
        if superlative:  # tantissimo -> tanto
            candidates.append(lemma(superlative.group(1) + "o"))
        if len(word) > 4 and word[-1] in "aie":  # vista -> visto -> vedere
            candidates.append(lemma(word[:-1] + "o"))
        for clitic in _CLITICS:
            if word.endswith(clitic) and len(word) > len(clitic) + 3:
                stem = word[: -len(clitic)]
                candidates.append(lemma(stem))
                if stem.endswith("r"):  # mangiar-lo -> mangiare
                    candidates.append(stem + "e")
        seen: dict[str, None] = {}
        for c in candidates:
            seen.setdefault(c.lower(), None)
        return list(seen)


@dataclass(frozen=True)
class LemmaList:
    """Lemma -> frequency rank (1 = most frequent), from the content seed."""

    ranks: dict[str, int]

    @classmethod
    def load(
        cls,
        path: Path = DEFAULT_LEMMA_FILE,
        core_vocab: Path | None = DEFAULT_CORE_VOCAB_FILE,
    ) -> LemmaList:
        """Seed ranks, lowered for the curated core vocabulary (see `data/core_vocab.tsv`)."""
        ranks: dict[str, int] = {}

        def add(lemma: str, rank: int) -> None:
            lemma = lemma.lower()
            if lemma not in ranks or rank < ranks[lemma]:
                ranks[lemma] = rank

        with path.open(encoding="utf-8", newline="") as fh:
            for row in csv.DictReader(fh, delimiter="\t"):
                add(row["lemma"], int(row["rank"]))
        if core_vocab is not None:
            lines = [
                line
                for line in core_vocab.read_text(encoding="utf-8").splitlines()
                if line.strip() and not line.startswith("#")
            ]
            for row in csv.DictReader(lines, delimiter="\t"):
                for word in row["lemma"].split():
                    add(word, _CORE_RANK[row["level"]])
        return cls(ranks)

    def rank(self, lemma: str) -> int | None:
        found = self.ranks.get(lemma)
        if found is None:
            found = self.ranks.get(strip_accents(lemma))
        return found


@cache
def default_lemma_list() -> LemmaList:
    return LemmaList.load()


@dataclass(frozen=True)
class OutOfBand:
    token: str
    lemma: str
    rank: int | None
    """None when the lemma is not in the list at all (rarer than the whole list)."""


@dataclass(frozen=True)
class BandReport:
    content_tokens: int
    out_of_band: list[OutOfBand] = field(default_factory=list)
    sentence_lengths: list[int] = field(default_factory=list)

    @property
    def ratio(self) -> float:
        return len(self.out_of_band) / self.content_tokens if self.content_tokens else 0.0

    @property
    def max_sentence_words(self) -> int:
        return max(self.sentence_lengths, default=0)


class BandChecker:
    """Checks a tutor reply against a level band."""

    def __init__(self, lemma_list: LemmaList, lemmatizer: Lemmatizer) -> None:
        self._list = lemma_list
        self._lemmatizer = lemmatizer

    def lemma_set(self, words: Iterable[str]) -> set[str]:
        """Every candidate lemma of every token in `words` (for allowed-vocabulary lists)."""
        out: set[str] = set()
        for phrase in words:
            for token in tokenize(phrase):
                out.update(self._lemmatizer.lemmas(token.lower()))
        return out

    def check(
        self,
        text: str,
        band: LevelBand,
        allowed: Sequence[str] = (),
    ) -> BandReport:
        allowed_lemmas = self.lemma_set(allowed)
        out: list[OutOfBand] = []
        content = 0
        for sentence in split_sentences(text):
            for index, token in enumerate(tokenize(sentence)):
                lower = token.lower()
                if token[0].isdigit() or lower in CLOSED_CLASS:
                    continue
                if index > 0 and token[0].isupper():
                    continue  # proper noun mid-sentence
                content += 1
                candidates = self._lemmatizer.lemmas(lower)
                if allowed_lemmas.intersection(candidates):
                    continue
                ranks = [r for r in (self._list.rank(c) for c in candidates) if r is not None]
                best = min(ranks) if ranks else None
                if best is not None and best <= band.lemma_ceiling:
                    continue
                if index == 0 and best is None and token[0].isupper() and candidates == [lower]:
                    continue  # sentence-initial word unknown to list and lemmatiser: a name
                out.append(OutOfBand(token=token, lemma=candidates[-1], rank=best))
        return BandReport(
            content_tokens=content, out_of_band=out, sentence_lengths=words_per_sentence(text)
        )


def extract_seed_lemmas(seed_path: Path, out_path: Path) -> int:
    """Write `rank<TAB>lemma<TAB>pos` rows from a content seed JSON (seed.v1.json)."""
    seed = json.loads(seed_path.read_text(encoding="utf-8"))
    rows = sorted(seed["lemmas"], key=lambda r: int(r["freqRank"]))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh, delimiter="\t", lineterminator="\n")
        writer.writerow(["rank", "lemma", "pos"])
        for row in rows:
            writer.writerow([row["freqRank"], row["lemma"], row["pos"]])
    return len(rows)
