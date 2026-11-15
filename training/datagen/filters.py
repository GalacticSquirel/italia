"""Automatic quality filters for synthetic dialogues.

Each check returns reasons (empty when it passes) and metrics. The checks are:

- schema: every tutor turn validates against the committed JSON Schema
- structure: turn count, reply length
- annotations: learnerText copied from the learner turn, valid tags and goal ids, newWords cap
- policy: the tutor's feedback moves agree with the plan (prompt first, recast second, no
  over-correction)
- prompt reveals correction: a prompt reply contains the correction it should leave to the
  learner (see `prompt_reveal_reasons`)
- band: share of out-of-band tokens per reply and sentence length, against the level band
- language: replies are in Italian (A1 may carry a bracketed English gloss)
- grammar: LanguageTool errors per 100 words in replies, and none in recast corrections
"""

from __future__ import annotations

import json
import re
from collections.abc import Sequence
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from functools import cache
from typing import Any

import jsonschema

from datagen.config import FilterConfig
from datagen.languagetool import GrammarChecker, errors_per_100_words
from datagen.lemmas import CLOSED_CLASS, BandChecker, tokenize
from datagen.records import DialogueRecord, FilterResult
from spec.levels import Level, band_for
from spec.models import Scenario, TutorOutput
from spec.taxonomy import SPEC_DIR, error_tags

_ENGLISH = frozenset(
    [
        "the",
        "and",
        "is",
        "are",
        "you",
        "your",
        "what",
        "how",
        "where",
        "when",
        "this",
        "that",
        "it",
        "of",
        "to",
        "for",
        "with",
        "have",
        "has",
        "do",
        "does",
        "please",
        "thanks",
        "yes",
        "my",
        "me",
        "we",
        "they",
        "would",
        "could",
        "should",
        "can",
        "will",
        "just",
        "very",
    ]
)
_BRACKETED = re.compile(r"\([^)]*\)")


@cache
def output_validator() -> jsonschema.protocols.Validator:
    schema = json.loads((SPEC_DIR / "schema" / "tutor_output.v1.schema.json").read_text())
    cls = jsonschema.validators.validator_for(schema)
    cls.check_schema(schema)
    validator: jsonschema.protocols.Validator = cls(schema)
    return validator


def schema_errors(payload: Any) -> list[str]:
    """JSON Schema errors for one tutor output (as parsed JSON)."""
    return [e.message for e in output_validator().iter_errors(payload)]


def parse_tutor_output(text: str) -> tuple[TutorOutput | None, list[str]]:
    """Strictly parse raw model text as a tutor output (no prose or fences allowed)."""
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as err:
        return None, [f"invalid JSON: {err.msg}"]
    errors = schema_errors(payload)
    if errors:
        return None, errors
    try:
        return TutorOutput.model_validate(payload), []
    except ValueError as err:
        return None, [str(err)]


def english_ratio(text: str, *, allow_brackets: bool) -> float:
    if allow_brackets:
        text = _BRACKETED.sub(" ", text)
    tokens = [t.lower() for t in tokenize(text)]
    if not tokens:
        return 0.0
    return sum(t in _ENGLISH for t in tokens) / len(tokens)


def _norm(text: str) -> str:
    return " ".join(text.lower().replace("\u2019", "'").split())


@dataclass
class TurnCheck:
    """Checks for one tutor turn, reusable by the evaluation."""

    reasons: list[str] = field(default_factory=list)
    out_of_band_ratio: float = 0.0
    content_tokens: int = 0
    out_of_band_tokens: int = 0
    max_sentence_words: int = 0


def annotation_reasons(
    output: TutorOutput, scenario: Scenario, previous_learner: str | None
) -> list[str]:
    """Consistency of the annotations with the learner turn, the reply and the scenario."""
    reasons: list[str] = []
    ann = output.annotations
    taxonomy = error_tags()
    for feedback in (ann.prompt, ann.recast):
        if feedback is None:
            continue
        unknown = [t for t in feedback.error_tags if t not in taxonomy]
        if unknown:
            reasons.append(f"unknown error tags {unknown}")
        if previous_learner is None:
            reasons.append("correction without a learner turn")
        elif _norm(feedback.learner_text) not in _norm(previous_learner):
            reasons.append("learnerText not found in the learner turn")
    if ann.recast is not None and _norm(ann.recast.corrected_text) not in _norm(output.reply):
        reasons.append("recast correctedText not used in the reply")
    goal_ids = {g.id for g in scenario.goals}
    bad_goals = [g for g in ann.scenario_progress.goals_completed if g not in goal_ids]
    if bad_goals:
        reasons.append(f"unknown goal ids {bad_goals}")
    return reasons


def check_tutor_turn(
    output: TutorOutput,
    *,
    level: Level,
    scenario: Scenario,
    previous_learner: str | None,
    band_checker: BandChecker,
    config: FilterConfig,
    lemma_ceiling: int | None = None,
) -> TurnCheck:
    band = band_for(level, lemma_ceiling)
    result = TurnCheck(reasons=annotation_reasons(output, scenario, previous_learner))
    ann = output.annotations
    if len(output.reply) > config.max_reply_chars:
        result.reasons.append("reply too long")
    if len(ann.new_words) > band.max_new_words:
        result.reasons.append("too many new words")

    allowed = [*scenario.key_vocab, *(w.lemma for w in ann.new_words)]
    echoed = [previous_learner or ""]
    echoed.extend(f.learner_text for f in (ann.prompt, ann.recast) if f is not None)
    report = band_checker.check(output.reply, band, allowed, echoed=echoed)
    result.out_of_band_ratio = report.ratio
    result.content_tokens = report.content_tokens
    result.out_of_band_tokens = len(report.out_of_band)
    result.max_sentence_words = report.max_sentence_words
    if report.ratio > band.max_out_of_band_ratio + config.band_slack:
        words = ", ".join(o.token for o in report.out_of_band[:5])
        result.reasons.append(f"out of band ({report.ratio:.0%}): {words}")
    if report.max_sentence_words > band.max_words_per_sentence + config.sentence_slack_words:
        result.reasons.append(f"sentence too long ({report.max_sentence_words} words)")
    if len(report.sentence_lengths) > band.max_sentences + 1:
        result.reasons.append(f"too many sentences ({len(report.sentence_lengths)})")
    if english_ratio(output.reply, allow_brackets=band.english_allowed) > config.max_english_ratio:
        result.reasons.append("reply not in Italian")
    return result


def policy_agreement(record: DialogueRecord) -> tuple[float, list[str]]:
    """Share of tutor reactions whose move (and tag, when correcting) matches the plan."""
    tutor = record.tutor_turns()[1:]  # the opening turn reacts to nothing
    if not record.plan:
        return 1.0, []
    agree = 0
    notes: list[str] = []
    for index, (plan, turn) in enumerate(zip(record.plan, tutor, strict=False), start=1):
        assert turn.output is not None
        ann = turn.output.annotations
        ok = ann.move == plan.expected_move
        if ok and plan.target_tag is not None and plan.expected_move != "none":
            ok = plan.target_tag in ann.error_tags
        if ok:
            agree += 1
        else:
            notes.append(f"turn {index}: expected {plan.expected_move}, got {ann.move}")
    return agree / len(record.plan), notes


def _changed_tokens(wrong: str, right: str) -> set[str]:
    """Tokens of `right` that correct a token of `wrong`: new, not closed-class, and a close
    variant of a wrong token (piccolo -> piccola, andarò -> andrò)."""
    wrong_tokens = {t.lower() for t in tokenize(wrong)}
    out: set[str] = set()
    for token in (t.lower() for t in tokenize(right)):
        if token in wrong_tokens or token in CLOSED_CLASS or len(token) < 3:
            continue
        if any(SequenceMatcher(None, token, w).ratio() >= 0.75 for w in wrong_tokens):
            out.add(token)
    return out


def reveals_correction(reply: str, learner_text: str, corrected_text: str) -> bool:
    """Whether a prompt reply gives away the correction of `learner_text`.

    True when the reply contains the whole corrected span, or any corrected token (a close
    variant of a wrong token, such as piccola for piccolo).
    """
    reply_norm = _norm(reply)
    corrected = _norm(corrected_text)
    if corrected and corrected not in _norm(learner_text) and corrected in reply_norm:
        return True
    reply_tokens = {t.lower() for t in tokenize(reply)}
    return bool(_changed_tokens(learner_text, corrected_text) & reply_tokens)


def prompt_reveal_reasons(record: DialogueRecord) -> list[str]:
    """Prompts whose reply contains the correction they should leave to the learner.

    The correction a prompt withholds is known from what follows it: the next recast of the
    same error (its correctedText), or the learner's next turn when it repairs the error.
    """
    reasons: list[str] = []
    turns = record.turns
    learner_index = -1
    for index, turn in enumerate(turns):
        if turn.output is None:
            learner_index += 1
            continue
        prompt = turn.output.annotations.prompt
        if prompt is None:
            continue
        corrections: list[str] = []
        for later in turns[index + 1 :]:
            recast = later.output.annotations.recast if later.output is not None else None
            if recast is not None and set(recast.error_tags) & set(prompt.error_tags):
                corrections.append(recast.corrected_text)
                break
        nxt = learner_index + 1
        repairs = nxt < len(record.plan) and record.plan[nxt].kind == "repair-success"
        if index + 1 < len(turns) and (repairs or not record.plan):
            corrections.append(turns[index + 1].text)
        if any(reveals_correction(turn.output.reply, prompt.learner_text, c) for c in corrections):
            reasons.append(f"turn {index}: prompt reveals the correction")
    return reasons


def filter_dialogue(
    record: DialogueRecord,
    *,
    band_checker: BandChecker,
    grammar: GrammarChecker,
    config: FilterConfig,
) -> FilterResult:
    reasons: list[str] = []
    metrics: dict[str, float] = {}
    scenario = record.context.scenario
    ceiling = record.context.learner.lemma_ceiling
    previous_learner: str | None = None
    ratios: list[float] = []
    replies: list[str] = []
    corrections: list[str] = []
    for index, turn in enumerate(record.turns):
        if turn.output is None:
            previous_learner = turn.text
            continue
        errors = schema_errors(turn.output.to_wire())
        if errors:
            reasons.append(f"turn {index}: schema: {errors[0]}")
        check = check_tutor_turn(
            turn.output,
            level=record.level,
            scenario=scenario,
            previous_learner=previous_learner,
            band_checker=band_checker,
            config=config,
            lemma_ceiling=ceiling,
        )
        reasons.extend(f"turn {index}: {r}" for r in check.reasons)
        ratios.append(check.out_of_band_ratio)
        replies.append(turn.output.reply)
        if turn.output.annotations.recast is not None:
            corrections.append(turn.output.annotations.recast.corrected_text)

    reasons.extend(prompt_reveal_reasons(record))
    agreement, notes = policy_agreement(record)
    metrics["policy_agreement"] = agreement
    if agreement < config.min_policy_agreement:
        reasons.append(f"policy agreement {agreement:.0%}: {'; '.join(notes[:3])}")

    lt_rate = errors_per_100_words(grammar, replies)
    metrics["lt_errors_per_100_words"] = lt_rate
    if lt_rate > config.max_lt_errors_per_100_words:
        reasons.append(f"LanguageTool: {lt_rate:.1f} errors per 100 words")
    bad_corrections = [c for c in corrections if grammar.check(c)]
    if bad_corrections:
        reasons.append(f"recast correction flagged by LanguageTool: {bad_corrections[0]!r}")
    metrics["mean_out_of_band_ratio"] = sum(ratios) / len(ratios) if ratios else 0.0
    metrics["tutor_turns"] = float(len(replies))
    return FilterResult(passed=not reasons, reasons=reasons, metrics=metrics)


def summarize(results: Sequence[FilterResult]) -> dict[str, int]:
    """Count of dialogues failing each kind of reason (the text before the first colon/paren)."""
    counts: dict[str, int] = {}
    for result in results:
        kinds = {re.sub(r"^turn \d+: ", "", r).split(":")[0].split(" (")[0] for r in result.reasons}
        for kind in kinds:
            counts[kind] = counts.get(kind, 0) + 1
    return dict(sorted(counts.items(), key=lambda kv: -kv[1]))
