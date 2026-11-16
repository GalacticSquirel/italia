"""LanguageTool (Italian) grammaticality checks over its HTTP API.

Run a local server for bulk work (the public API is rate-limited):

    docker run -d -p 8010:8010 erikvl87/languagetool   # or: java -jar languagetool-server.jar

then point `languageTool.url` at `http://localhost:8010/v2`.
"""

from __future__ import annotations

import threading
from collections import OrderedDict
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Protocol

import httpx

from datagen.lemmas import tokenize

# Rules that flag style or typography rather than grammar; the tutor's short spoken-style replies
# trip them constantly and they say nothing about whether the Italian is correct.
DEFAULT_IGNORED_CATEGORIES = frozenset({"TYPOGRAPHY", "STYLE", "CASING", "REDUNDANCY"})
DEFAULT_IGNORED_RULES = frozenset({"WHITESPACE_RULE", "UPPERCASE_SENTENCE_START"})


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

    With the checked `text`, a spelling match on a capitalised word is dropped too: those are
    names (Miller, Murphy, García) that the Italian dictionary does not know.
    """
    raw = payload.get("matches", [])
    if not isinstance(raw, list):
        raise ValueError("unexpected LanguageTool response: 'matches' is not a list")
    out: list[GrammarMatch] = []
    for item in raw:
        rule = item.get("rule", {})
        rule_id = str(rule.get("id", ""))
        category = str(rule.get("category", {}).get("id", ""))
        if rule_id in ignored_rules or category in ignored_categories:
            continue
        match = GrammarMatch(
            rule_id=rule_id,
            category=category,
            message=str(item.get("message", "")),
            offset=int(item.get("offset", 0)),
            length=int(item.get("length", 0)),
        )
        misspelling = category == "TYPOS" or rule.get("issueType") == "misspelling"
        if text is not None and misspelling and _is_name(match.span(text)):
            continue
        out.append(match)
    return out


def _is_name(span: str) -> bool:
    """A capitalised word that is not all capitals (an acronym or a shouted word is checked)."""
    return span[:1].isupper() and not span.isupper()


def errors_per_100_words(checker: GrammarChecker, texts: list[str]) -> float:
    """LanguageTool matches per 100 words over `texts` (0 for no words)."""
    words = sum(len(tokenize(t)) for t in texts)
    if words == 0:
        return 0.0
    errors = sum(len(checker.check(t)) for t in texts)
    return 100.0 * errors / words


class NullChecker:
    """A checker that finds nothing; used when LanguageTool is disabled in the config."""

    def check(self, text: str) -> list[GrammarMatch]:
        del text
        return []
