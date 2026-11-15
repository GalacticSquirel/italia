"""Automatic metrics for tutor predictions against evaluation items.

- JSON validity: strict parse against the output schema (what llama.rn's grammar enforces)
- grammaticality: LanguageTool errors per 100 reply words, and share of replies with any error
- level adherence: share of content tokens outside the band; replies over the band limit;
  sentences over the word limit
- feedback: move accuracy (none/prompt/recast), over- and under-correction rates
- error tags: micro and macro precision/recall/F1 against the gold tags
- recast correctness: on items where a recast is due, the prediction recasts the right error and
  its correction matches the reference correction and passes LanguageTool
- annotation consistency: learnerText copied from the learner, goal ids valid, correction used
"""

from __future__ import annotations

from collections import Counter, defaultdict
from collections.abc import Sequence
from dataclasses import dataclass, field

from datagen.config import FilterConfig
from datagen.filters import annotation_reasons, check_tutor_turn, english_ratio, parse_tutor_output
from datagen.languagetool import GrammarChecker
from datagen.lemmas import BandChecker, tokenize
from eval.items import EvalItem
from spec.levels import band_for
from spec.models import FeedbackMove, TutorOutput

MOVES: tuple[FeedbackMove, ...] = ("none", "prompt", "recast")


@dataclass(frozen=True)
class Prf:
    precision: float
    recall: float
    f1: float
    support: int


def prf(tp: int, fp: int, fn: int) -> Prf:
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return Prf(precision, recall, f1, tp + fn)


def tag_scores(
    gold: Sequence[set[str]], predicted: Sequence[set[str]]
) -> tuple[Prf, Prf, dict[str, Prf]]:
    """Micro and macro P/R/F1 over items, and per-tag scores (macro over tags with support)."""
    counts: dict[str, list[int]] = defaultdict(lambda: [0, 0, 0])  # tp, fp, fn
    for g, p in zip(gold, predicted, strict=True):
        for tag in g & p:
            counts[tag][0] += 1
        for tag in p - g:
            counts[tag][1] += 1
        for tag in g - p:
            counts[tag][2] += 1
    tp = sum(c[0] for c in counts.values())
    fp = sum(c[1] for c in counts.values())
    fn = sum(c[2] for c in counts.values())
    per_tag = {tag: prf(*c) for tag, c in sorted(counts.items())}
    supported = [s for s in per_tag.values() if s.support > 0]
    macro = Prf(
        precision=_mean([s.precision for s in supported]),
        recall=_mean([s.recall for s in supported]),
        f1=_mean([s.f1 for s in supported]),
        support=sum(s.support for s in supported),
    )
    return prf(tp, fp, fn), macro, per_tag


def _mean(values: Sequence[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _norm(text: str) -> str:
    return " ".join(tokenize(text.lower()))


@dataclass
class SystemScores:
    system: str
    items: int = 0
    json_valid: int = 0
    lt_errors: int = 0
    reply_words: int = 0
    replies_with_lt_error: int = 0
    content_tokens: int = 0
    out_of_band_tokens: int = 0
    replies_over_band: int = 0
    sentences_over_limit: int = 0
    italian_only: int = 0
    move_confusion: Counter[tuple[str, str]] = field(default_factory=Counter)
    recast_due: int = 0
    recast_correct: int = 0
    annotations_consistent: int = 0
    gold_tags: list[set[str]] = field(default_factory=list)
    predicted_tags: list[set[str]] = field(default_factory=list)
    by_level: dict[str, Counter[str]] = field(default_factory=lambda: defaultdict(Counter))

    def rate(self, numerator: int, denominator: int | None = None) -> float:
        d = self.items if denominator is None else denominator
        return numerator / d if d else 0.0

    @property
    def move_accuracy(self) -> float:
        right = sum(n for (g, p), n in self.move_confusion.items() if g == p)
        return self.rate(right)

    @property
    def over_correction(self) -> float:
        """Share of turns needing no correction that the system corrected anyway."""
        none_gold = sum(n for (g, _p), n in self.move_confusion.items() if g == "none")
        wrong = sum(n for (g, p), n in self.move_confusion.items() if g == "none" and p != "none")
        return self.rate(wrong, none_gold)

    @property
    def under_correction(self) -> float:
        due = sum(n for (g, _p), n in self.move_confusion.items() if g != "none")
        missed = sum(n for (g, p), n in self.move_confusion.items() if g != "none" and p == "none")
        return self.rate(missed, due)

    def summary(self) -> dict[str, float]:
        micro, macro, _ = tag_scores(self.gold_tags, self.predicted_tags)
        return {
            "items": float(self.items),
            "json_validity": self.rate(self.json_valid),
            "lt_errors_per_100_words": 100 * self.rate(self.lt_errors, self.reply_words),
            "replies_with_lt_error": self.rate(self.replies_with_lt_error, self.json_valid),
            "out_of_band_token_rate": self.rate(self.out_of_band_tokens, self.content_tokens),
            "replies_over_band": self.rate(self.replies_over_band, self.json_valid),
            "sentences_over_limit": self.rate(self.sentences_over_limit, self.json_valid),
            "italian_only": self.rate(self.italian_only, self.json_valid),
            "move_accuracy": self.move_accuracy,
            "over_correction": self.over_correction,
            "under_correction": self.under_correction,
            "recast_correctness": self.rate(self.recast_correct, self.recast_due),
            "tag_f1_micro": micro.f1,
            "tag_f1_macro": macro.f1,
            "tag_precision_micro": micro.precision,
            "tag_recall_micro": micro.recall,
            "annotation_consistency": self.rate(self.annotations_consistent, self.json_valid),
        }


def _recast_correct(pred: TutorOutput, item: EvalItem, grammar: GrammarChecker) -> bool:
    recast = pred.annotations.recast
    if recast is None or item.gold.target_tag not in recast.error_tags:
        return False
    reference, _ = parse_tutor_output(item.reference)
    expected = reference.annotations.recast if reference is not None else None
    if expected is not None and _norm(expected.corrected_text) != _norm(recast.corrected_text):
        return False
    return not grammar.check(recast.corrected_text)


def score_system(
    system: str,
    items: Sequence[EvalItem],
    predictions: dict[str, str],
    *,
    band_checker: BandChecker,
    grammar: GrammarChecker,
    filters: FilterConfig | None = None,
) -> SystemScores:
    """Score one system's predictions (item id -> raw model text). Missing ones count invalid."""
    config = filters or FilterConfig()
    scores = SystemScores(system=system)
    for item in items:
        scores.items += 1
        level = item.level.value
        scores.by_level[level]["items"] += 1
        gold_move = item.gold.expected_move
        if gold_move == "recast":
            scores.recast_due += 1
        pred, _errors = parse_tutor_output(predictions.get(item.id, ""))
        if pred is None:
            scores.move_confusion[(gold_move, "invalid")] += 1
            scores.gold_tags.append(item.gold.tags)
            scores.predicted_tags.append(set())
            continue
        scores.json_valid += 1
        scores.by_level[level]["json_valid"] += 1
        scores.move_confusion[(gold_move, pred.annotations.move)] += 1
        if gold_move == pred.annotations.move:
            scores.by_level[level]["move_correct"] += 1
        scores.gold_tags.append(item.gold.tags)
        scores.predicted_tags.append(set(pred.annotations.error_tags))
        if gold_move == "recast" and _recast_correct(pred, item, grammar):
            scores.recast_correct += 1

        matches = grammar.check(pred.reply)
        words = len(tokenize(pred.reply))
        scores.lt_errors += len(matches)
        scores.reply_words += words
        scores.replies_with_lt_error += bool(matches)
        check = check_tutor_turn(
            pred,
            level=item.level,
            scenario=item.context.scenario,
            previous_learner=item.learner_text,
            band_checker=band_checker,
            config=config,
            lemma_ceiling=item.context.learner.lemma_ceiling,
        )
        band = band_for(item.level, item.context.learner.lemma_ceiling)
        scores.content_tokens += check.content_tokens
        scores.out_of_band_tokens += check.out_of_band_tokens
        scores.by_level[level]["content_tokens"] += check.content_tokens
        scores.by_level[level]["out_of_band_tokens"] += check.out_of_band_tokens
        if check.out_of_band_ratio > band.max_out_of_band_ratio:
            scores.replies_over_band += 1
        if check.max_sentence_words > band.max_words_per_sentence:
            scores.sentences_over_limit += 1
        if (
            english_ratio(pred.reply, allow_brackets=band.english_allowed)
            <= config.max_english_ratio
        ):
            scores.italian_only += 1
        if not annotation_reasons(pred, item.context.scenario, item.learner_text):
            scores.annotations_consistent += 1
    return scores
