"""The real-learner check: sentences real learners wrote, judged against native corrections.

Every other benchmark item was written by a model imitating a learner. These items are the
held-out (`split: eval`) MERLIN sentence pairs of `datagen.learner_corpus`, one sentence per item,
said to a friend in the eval-only `raccontare-novita` scenario (catching up by phone). The
sentences come from letters, so letter formulas, shouted (all-capitals) sentences, fragments and
accent-only corrections are left out: they would test writing, not conversation. A native
corrector's minimal correction is the only gold label, so the scores are independent of any model:

- detection: on sentences the native corrector changed, the tutor corrects something (a prompt or
  a recast); the rest are missed errors
- false flags: on sentences the native corrector left alone (punctuation and case aside, since
  the learner speaks), the tutor corrects something anyway
- native fix: of the tutor's recasts on changed sentences, the share whose correction is a span of
  the native correction and whose learner span is a span of the learner's sentence

Native minimal corrections leave a few real errors in place, so a false-flag rate of a few per
cent is the floor, not zero.
"""

from __future__ import annotations

import random
import re
import unicodedata
from collections import defaultdict
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field

from datagen.filters import parse_tutor_output
from datagen.learner_corpus import LearnerPair, words
from spec.levels import Level
from spec.models import (
    Annotations,
    LearnerProfile,
    Scenario,
    ScenarioProgress,
    Turn,
    TutorContext,
    TutorOutput,
    WireModel,
)
from spec.render import render_messages
from spec.scenarios import load_library

SCENARIO_ID = "raccontare-novita"
# Letter formulas that make no sense said aloud to a friend.
_LETTER_FORMULA = re.compile(
    r"\b(car[aoie]|gentil[ei]|egregi[oa]|spettabile|saluti|salutoni|abbracci\w*|baci|bacioni"
    r"|distinti|cordiali|ringraziandovi|in attesa|lettera|e-?mail)\b",
    re.IGNORECASE,
)


class LearnerItem(WireModel):
    id: str
    level: Level
    context: TutorContext
    messages: list[dict[str, str]]
    learner_text: str
    native_text: str
    changed: bool


def _opening(scenario: Scenario) -> Turn:
    return Turn.tutor(
        TutorOutput(
            reply=scenario.opening,
            annotations=Annotations(
                prompt=None,
                recast=None,
                new_words=[],
                scenario_progress=ScenarioProgress(goals_completed=[], done=False),
            ),
        )
    )


def is_conversational(text: str) -> bool:
    """Could be said to a friend: no letter formula, not shouted, starts like a sentence."""
    letters = [c for c in text if c.isalpha()]
    shouted = sum(c.isupper() for c in letters) > len(letters) / 2
    return text[:1].isalnum() and not shouted and not _LETTER_FORMULA.search(text)


def _plain(text: str) -> list[str]:
    folded = unicodedata.normalize("NFKD", text)
    return words("".join(c for c in folded if not unicodedata.combining(c)))


def accent_only(pair: LearnerPair) -> bool:
    """The native changed only accents ("perchè", "mercoledi"), which nobody hears in speech."""
    return pair.changed and _plain(pair.learner) == _plain(pair.native)


def learner_item(pair: LearnerPair, scenario: Scenario) -> LearnerItem:
    context = TutorContext(learner=LearnerProfile(level=pair.level), scenario=scenario)
    messages = render_messages(context, [_opening(scenario), Turn.learner(pair.learner)])
    return LearnerItem(
        id=pair.id,
        level=pair.level,
        context=context,
        messages=[{"role": m["role"], "content": m["content"]} for m in messages],
        learner_text=pair.learner,
        native_text=pair.native,
        changed=pair.changed,
    )


def build_learner_items(
    pairs: Iterable[LearnerPair], *, per_group: int, seed: int = 0
) -> list[LearnerItem]:
    """Held-out pairs, at most `per_group` changed and `per_group` unchanged per level."""
    groups: dict[tuple[Level, bool], list[LearnerPair]] = defaultdict(list)
    for pair in pairs:
        if pair.split == "eval" and is_conversational(pair.learner) and not accent_only(pair):
            groups[pair.level, pair.changed].append(pair)
    scenario = load_library()[SCENARIO_ID]
    rng = random.Random(seed)
    items: list[LearnerItem] = []
    for key in sorted(groups):
        group = sorted(groups[key], key=lambda p: p.id)
        chosen = rng.sample(group, min(per_group, len(group)))
        items += [learner_item(p, scenario) for p in sorted(chosen, key=lambda p: p.id)]
    return items


def _contains(haystack: list[str], needle: list[str]) -> bool:
    n = len(needle)
    return n > 0 and any(haystack[i : i + n] == needle for i in range(len(haystack) - n + 1))


def matches_native(learner_span: str, corrected: str, item: LearnerItem) -> bool:
    """The recast copies a span of the learner's sentence and corrects it as the native did."""
    return _contains(words(item.learner_text), words(learner_span)) and _contains(
        words(item.native_text), words(corrected)
    )


@dataclass
class Counts:
    changed: int = 0
    detected: int = 0
    unchanged: int = 0
    flagged: int = 0
    recasts: int = 0
    native_fixes: int = 0
    invalid: int = 0

    def add(self, other: Counts) -> None:
        for name in vars(self):
            setattr(self, name, getattr(self, name) + getattr(other, name))


@dataclass
class LearnerScores:
    system: str
    total: Counts = field(default_factory=Counts)
    by_level: dict[Level, Counts] = field(default_factory=dict)


def _score_one(item: LearnerItem, text: str) -> Counts:
    counts = Counts()
    pred, _errors = parse_tutor_output(text)
    move = "none" if pred is None else pred.annotations.move
    counts.invalid = int(pred is None)
    if item.changed:
        counts.changed = 1
        counts.detected = int(move != "none")
        recast = None if pred is None else pred.annotations.recast
        if recast is not None:
            counts.recasts = 1
            counts.native_fixes = int(
                matches_native(recast.learner_text, recast.corrected_text, item)
            )
    else:
        counts.unchanged = 1
        counts.flagged = int(move != "none")
    return counts


def score_learner(
    system: str, items: Sequence[LearnerItem], predictions: dict[str, str]
) -> LearnerScores:
    scores = LearnerScores(system)
    for item in items:
        counts = _score_one(item, predictions.get(item.id, ""))
        scores.total.add(counts)
        scores.by_level.setdefault(item.level, Counts()).add(counts)
    return scores


def _pct(numerator: int, denominator: int) -> str:
    return (
        f"{100 * numerator / denominator:.1f}% ({numerator}/{denominator})" if denominator else "-"
    )


def _row(label: str, c: Counts) -> str:
    return (
        f"| {label} | {_pct(c.detected, c.changed)} | {_pct(c.flagged, c.unchanged)} "
        f"| {_pct(c.native_fixes, c.recasts)} | {c.invalid} |"
    )


def render_learner_report(title: str, scores: Sequence[LearnerScores]) -> str:
    """Markdown: one table for all systems, then one per system by level."""
    header = [
        "| System | Errors detected | False flags | Recast matches native | Invalid JSON |",
        "|---|---|---|---|---|",
    ]
    lines = [f"# {title}", "", *header, *(_row(s.system, s.total) for s in scores)]
    for s in scores:
        lines += ["", f"## {s.system} by level", "", *header]
        lines += [_row(level.value, s.by_level[level]) for level in sorted(s.by_level)]
    return "\n".join(lines) + "\n"
