"""Grammar points and the learner error-tag taxonomy.

Grammar point slugs come from `packages/content/src/grammar/points.ts`; points marked
`inContent: false` exist only here until the content package adds them. Every error tag maps to the
grammar points it is evidence about, so an error recorded in conversation can be turned into a
review of the right grammar point in the app.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import cache
from pathlib import Path

from spec.levels import Level

SPEC_DIR = Path(__file__).resolve().parent


@dataclass(frozen=True)
class GrammarPoint:
    slug: str
    title: str
    cefr: Level
    prerequisites: tuple[str, ...]
    content_id: int | None
    """The `grammar_point.id` in the content package, or None for training-only points."""


@dataclass(frozen=True)
class ErrorTag:
    id: str
    label: str
    kind: str
    grammar_points: tuple[str, ...]
    description: str
    example_wrong: str
    example_right: str
    min_level: Level
    """Lowest level at which a learner is expected to attempt this structure."""


@cache
def grammar_points() -> dict[str, GrammarPoint]:
    """All grammar points by slug, in teaching order."""
    raw = json.loads((SPEC_DIR / "grammar_points.json").read_text(encoding="utf-8"))
    points: dict[str, GrammarPoint] = {}
    for item in raw["points"]:
        point = GrammarPoint(
            slug=item["slug"],
            title=item["title"],
            cefr=Level(item["cefr"]),
            prerequisites=tuple(item["prerequisites"]),
            content_id=item["id"],
        )
        points[point.slug] = point
    return points


@cache
def error_tags() -> dict[str, ErrorTag]:
    """All error tags by id, in taxonomy order."""
    raw = json.loads((SPEC_DIR / "error_tags.json").read_text(encoding="utf-8"))
    points = grammar_points()
    tags: dict[str, ErrorTag] = {}
    for item in raw["tags"]:
        slugs = tuple(item["grammarPoints"])
        levels = [points[s].cefr for s in slugs]
        min_level = min(levels, key=lambda lv: lv.rank) if levels else Level.A1
        tag = ErrorTag(
            id=item["id"],
            label=item["label"],
            kind=item["kind"],
            grammar_points=slugs,
            description=item["description"],
            example_wrong=item["example"]["wrong"],
            example_right=item["example"]["right"],
            min_level=min_level,
        )
        tags[tag.id] = tag
    return tags


def taxonomy_version() -> str:
    raw = json.loads((SPEC_DIR / "error_tags.json").read_text(encoding="utf-8"))
    return str(raw["version"])


def grammar_up_to(level: Level) -> list[GrammarPoint]:
    """Grammar points taught at or below `level`, in teaching order."""
    return [p for p in grammar_points().values() if p.cefr.at_most(level)]


def tags_for_level(level: Level) -> list[ErrorTag]:
    """Error tags a learner at `level` can plausibly produce."""
    return [t for t in error_tags().values() if t.min_level.at_most(level)]


def tags_for_grammar(slugs: set[str] | frozenset[str]) -> list[ErrorTag]:
    """Error tags that are evidence about any of the given grammar points."""
    return [t for t in error_tags().values() if slugs.intersection(t.grammar_points)]
