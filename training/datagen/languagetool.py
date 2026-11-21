"""LanguageTool (Italian) grammaticality checks over its HTTP API.

Run a local server for bulk work (the public API is rate-limited):

    docker run -d -p 8010:8010 erikvl87/languagetool   # or: java -jar languagetool-server.jar

then point `languageTool.url` at `http://localhost:8010/v2`.
"""

from __future__ import annotations

import re
import threading
from collections import OrderedDict
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from functools import cache
from typing import Protocol

import httpx

from datagen.lemmas import default_lemma_list, tokenize
from datagen.quotes import in_quotes, quoted_regions

# Rules that flag style or typography rather than grammar; the tutor's short spoken-style replies
# trip them constantly and they say nothing about whether the Italian is correct.
DEFAULT_IGNORED_CATEGORIES = frozenset({"TYPOGRAPHY", "STYLE", "CASING", "REDUNDANCY"})
DEFAULT_IGNORED_RULES = frozenset({"WHITESPACE_RULE", "UPPERCASE_SENTENCE_START"})
# ST_* are Italian style rules filed outside the STYLE category, e.g. ST_01_005 "budget" ->
# "bilancio" and ST_01_003 "io personalmente" (redundancy).
IGNORED_RULE_PREFIXES = ("ST_",)
# Loanwords and correct Italian forms the LanguageTool dictionary lacks.
KNOWN_WORDS = frozenset(
    {
        "budget",
        "location",
        "pilates",
        "wifi",
        "karaoke",
        "yoga",
        "smartworking",
        "weekend",
        "ibuprofene",
        "tienitelo",
        "vegano",
        "vegana",
        "vegani",
        "vegane",
        "videolezione",
        "videolezioni",
        "part",
        "time",
        "mea",
        "culpa",
        "spritz",
        "report",
        "rap",
        "montaliana",
        "showroom",
        "videochiamata",
        "videochiamate",
        "business",
        "plan",
        "catering",
        "brunch",
        "turnover",
        "centottantamila",
    }
)
# Words Italian doubles on purpose ("quasi quasi", "ciao ciao", "pian piano").
REDUPLICATED = frozenset(
    {
        "quasi",
        "ciao",
        "piano",
        "così",
        "subito",
        "presto",
        "bene",
        "via",
        "piccolo",
        "piccola",
        "piccoli",
        "piccole",
        "ah",
        "eh",
        "oh",
        "no",
        "sì",
    }
)
REPEAT_RULE = "ITALIAN_WORD_REPEAT_RULE"
# Correct phrases a LanguageTool rule misreads: ER_01_001 wants "ha" in "senza badare a spese",
# "a tratti", "a porte chiuse"; ER_01_002 wants "hai" in "una pizza ai quattro formaggi",
# "vicino ai taxi"; the speller rejects the elided "quattr'" of "a quattr'occhi".
KNOWN_PHRASES = (
    "badare a spese",
    "a sorpresa",
    "a tratti",
    "ai quattro formaggi",
    "ai taxi",
    "a porte chiuse",
    "a quattr'occhi",
)


@dataclass(frozen=True)
class GrammarMatch:
    rule_id: str
    category: str
    message: str
    offset: int
    length: int

    def span(self, text: str) -> str:
        return text[self.offset : self.offset + self.length]


class GrammarChecker(Protocol):
    def check(self, text: str) -> list[GrammarMatch]: ...


class LanguageToolClient:
    """Thread-safe client with an in-memory LRU cache of results."""

    def __init__(
        self,
        url: str,
        *,
        ignored_categories: frozenset[str] = DEFAULT_IGNORED_CATEGORIES,
        ignored_rules: frozenset[str] = DEFAULT_IGNORED_RULES,
        timeout: float = 30.0,
        cache_size: int = 50_000,
        client: httpx.Client | None = None,
    ) -> None:
        self._url = url.rstrip("/") + "/check"
        self._ignored_categories = ignored_categories
        self._ignored_rules = ignored_rules
        self._client = client or httpx.Client(timeout=timeout)
        self._cache: OrderedDict[str, list[GrammarMatch]] = OrderedDict()
        self._cache_size = cache_size
        self._lock = threading.Lock()

    def check(self, text: str) -> list[GrammarMatch]:
        with self._lock:
            if text in self._cache:
                self._cache.move_to_end(text)
                return self._cache[text]
        response = self._client.post(
            self._url,
            data={"text": text, "language": "it", "level": "default"},
        )
        response.raise_for_status()
        matches = parse_matches(
            response.json(), self._ignored_categories, self._ignored_rules, text=text
        )
        with self._lock:
            self._cache[text] = matches
            if len(self._cache) > self._cache_size:
                self._cache.popitem(last=False)
        return matches


def parse_matches(
    payload: Mapping[str, object],
    ignored_categories: frozenset[str] = DEFAULT_IGNORED_CATEGORIES,
    ignored_rules: frozenset[str] = DEFAULT_IGNORED_RULES,
    *,
    text: str | None = None,
) -> list[GrammarMatch]:
    """Turn a `/v2/check` response into matches, dropping ignored rules and categories.

    With the checked `text`, these are dropped too: any match inside quotation marks (a mention,
    such as an echo of the learner's mistake), a spelling match on a capitalised word (names such
    as Miller or García) or on a known loanword, and a deliberate reduplication ("quasi quasi").
    """
    raw = payload.get("matches", [])
    if not isinstance(raw, list):
        raise ValueError("unexpected LanguageTool response: 'matches' is not a list")
    regions = quoted_regions(text) if text is not None else []
    out: list[GrammarMatch] = []
    for item in raw:
        rule = item.get("rule", {})
        rule_id = str(rule.get("id", ""))
        category = str(rule.get("category", {}).get("id", ""))
        if rule_id in ignored_rules or category in ignored_categories:
            continue
        if rule_id.startswith(IGNORED_RULE_PREFIXES):
            continue
        match = GrammarMatch(
            rule_id=rule_id,
            category=category,
            message=str(item.get("message", "")),
            offset=int(item.get("offset", 0)),
            length=int(item.get("length", 0)),
        )
        if text is not None and _is_mention_or_known(match, rule, text, regions):
            continue
        out.append(match)
    return out


def _is_mention_or_known(
    match: GrammarMatch, rule: Mapping[str, object], text: str, regions: list[tuple[int, int]]
) -> bool:
    start, end = match.offset, match.offset + match.length
    if in_quotes(regions, start, end) or in_quotes(_phrase_regions(text), start, end):
        return True
    span = match.span(text)
    words = {w.lower() for w in tokenize(span)}
    category = rule.get("category")
    misspelling = rule.get("issueType") == "misspelling" or (
        isinstance(category, Mapping) and category.get("id") == "TYPOS"
    )
    if misspelling and (
        _is_name(span)
        or _is_affix(span, text, start)
        or (bool(words) and all(w in KNOWN_WORDS or _is_superlative(w) for w in words))
    ):
        return True
    return match.rule_id == REPEAT_RULE and bool(words) and words <= REDUPLICATED


_SUPERLATIVE = re.compile(r"^(\w+?)issim[oaie]$")


def _is_superlative(word: str) -> bool:
    """An absolute superlative of a known adjective ("inglesissimo", "saggissima")."""
    found = _SUPERLATIVE.match(word)
    if found is None:
        return False
    stem = found.group(1)
    candidates = {stem + "o", stem + "e", stem + "io"}
    if stem.endswith(("ch", "gh")):
        candidates.add(stem[:-1] + "o")
    return any(c in _lemmas() for c in candidates)


@cache
def _lemmas() -> frozenset[str]:
    return frozenset(default_lemma_list().ranks)


def _phrase_regions(text: str) -> list[tuple[int, int]]:
    lowered = text.lower()
    regions = []
    for phrase in KNOWN_PHRASES:
        start = lowered.find(phrase)
        while start >= 0:
            regions.append((start, start + len(phrase)))
            start = lowered.find(phrase, start + 1)
    return regions


def _is_affix(span: str, text: str, start: int) -> bool:
    """A suffix or prefix under discussion ("finisce in -a", "il prefisso ri-")."""
    before = text[start - 1] if start > 0 else ""
    after = text[start + len(span)] if start + len(span) < len(text) else ""
    return span.startswith("-") or span.endswith("-") or before == "-" or after == "-"


def _is_name(span: str) -> bool:
    """A capitalised word that is not all capitals (an acronym or a shouted word is checked)."""
    return span[:1].isupper() and not span.isupper()


def without_echoes(
    matches: list[GrammarMatch], text: str, echoed: str | None
) -> list[GrammarMatch]:
    """Drop matches whose words all come from `echoed` (the learner's turn the reply answers).

    A tutor repeats the learner's mistake to point at it ("Ha prenduto?" after "ho prenduto"),
    often changing the person or quoting one word, so the echo is found word by word.
    """
    if not echoed:
        return matches
    learner_words = {w.lower() for w in tokenize(echoed)}
    kept = []
    for m in matches:
        words = {w.lower() for w in tokenize(m.span(text))}
        if not words or not words <= learner_words:
            kept.append(m)
    return kept


def errors_per_100_words(
    checker: GrammarChecker, texts: list[str], echoed: Sequence[str | None] | None = None
) -> float:
    """LanguageTool matches per 100 words over `texts` (0 for no words).

    `echoed[i]`, when given, is the learner turn `texts[i]` replies to; see `without_echoes`.
    """
    words = sum(len(tokenize(t)) for t in texts)
    if words == 0:
        return 0.0
    sources = list(echoed) if echoed is not None else [None] * len(texts)
    errors = sum(
        len(without_echoes(checker.check(t), t, e)) for t, e in zip(texts, sources, strict=True)
    )
    return 100.0 * errors / words


class NullChecker:
    """A checker that finds nothing; used when LanguageTool is disabled in the config."""

    def check(self, text: str) -> list[GrammarMatch]:
        del text
        return []
