"""Judge-model passes: dialogue scoring, candidate ranking (for DPO) and pairwise comparison.

All judge prompts ask for JSON; the parsers are tolerant of surrounding prose and code fences,
clamp scores into range, and raise `JudgeParseError` for anything they cannot use.
"""

from __future__ import annotations

import random
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Literal

from datagen.jsonutil import JsonExtractError, extract_json_object
from datagen.records import DialogueRecord, JudgeResult, JudgeScores
from datagen.synthesis import dialogue_json
from datagen.teacher import ChatClient, Usage
from spec.render import render_system_prompt


class JudgeParseError(ValueError):
    pass


RUBRIC = """\
Score each criterion from 1 (bad) to 5 (excellent):
- grammaticality: the tutor's Italian is correct and natural (any mistake caps this at 2).
- levelFit: vocabulary and sentence length suit the learner's level and the stated limits.
- feedback: errors are handled prompt-first then recast, one error at a time, never correcting
  correct learner turns, never giving the answer away in a prompt.
- annotationAccuracy: prompt/recast spans, corrections, error tags, newWords and
  scenarioProgress are accurate.
- scenario: the tutor stays in role, keeps the task moving towards its goals, one question at a
  time.
- tone: warm, encouraging, brief; no lecturing."""

_DIALOGUE_PROMPT = """\
You are an expert teacher of Italian as a foreign language, reviewing a dialogue between an
on-device Italian TUTOR model and a learner at level {level}. The tutor was given these
instructions:
<tutor_instructions>
{system_prompt}
</tutor_instructions>

<dialogue>
{dialogue}
</dialogue>

{rubric}

Reply with JSON only:
{{"scores": {{"grammaticality": n, "levelFit": n, "feedback": n, "annotationAccuracy": n,
"scenario": n, "tone": n}}, "issues": ["short description of each problem, with turn number"]}}
"""

_CANDIDATES_PROMPT = """\
You are an expert teacher of Italian as a foreign language. Below is a conversation between an
Italian TUTOR and a learner at level {level}, followed by {n} candidate next tutor turns (JSON).
The tutor's instructions:
<tutor_instructions>
{system_prompt}
</tutor_instructions>

<conversation>
{conversation}
</conversation>

<candidates>
{candidates}
</candidates>

{rubric}

Score every candidate. Reply with JSON only:
{{"candidates": [{{"id": "A", "scores": {{"grammaticality": n, "levelFit": n, "feedback": n,
"annotationAccuracy": n, "scenario": n, "tone": n}}}}, ...]}}
"""

_PAIRWISE_PROMPT = """\
You are an expert teacher of Italian as a foreign language. Below is a conversation between an
Italian TUTOR and a learner at level {level}, and two candidate next tutor turns, A and B.
The tutor's instructions:
<tutor_instructions>
{system_prompt}
</tutor_instructions>

<conversation>
{conversation}
</conversation>

<A>
{a}
</A>

<B>
{b}
</B>

{rubric}

Which candidate is the better tutor turn overall? Reply with JSON only:
{{"winner": "A" | "B" | "tie", "reason": "one sentence"}}
"""

_KEYS = {
    "grammaticality": "grammaticality",
    "levelFit": "level_fit",
    "feedback": "feedback",
    "annotationAccuracy": "annotation_accuracy",
    "scenario": "scenario",
    "tone": "tone",
}


def _clamp(value: Any) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as err:
        raise JudgeParseError(f"score is not a number: {value!r}") from err
    return min(5.0, max(1.0, number))


def parse_scores(raw: Any) -> JudgeScores:
    if not isinstance(raw, dict):
        raise JudgeParseError("scores must be an object")
    missing = [k for k in _KEYS if k not in raw]
    if missing:
        raise JudgeParseError(f"missing scores: {missing}")
    return JudgeScores(**{py: _clamp(raw[wire]) for wire, py in _KEYS.items()})


def _extract(text: str) -> dict[str, Any]:
    try:
        return extract_json_object(text)
    except JsonExtractError as err:
        raise JudgeParseError(str(err)) from err


def parse_dialogue_judgement(text: str, judge: str = "") -> JudgeResult:
    raw = _extract(text)
    issues = raw.get("issues", [])
    if not isinstance(issues, list):
        issues = [str(issues)]
    return JudgeResult(
        scores=parse_scores(raw.get("scores")), issues=[str(i) for i in issues], judge=judge
    )


def parse_candidate_scores(text: str, ids: Sequence[str]) -> dict[str, JudgeScores]:
    raw = _extract(text)
    items = raw.get("candidates")
    if not isinstance(items, list):
        raise JudgeParseError("missing 'candidates' list")
    out: dict[str, JudgeScores] = {}
    for item in items:
        if isinstance(item, dict) and str(item.get("id")) in ids:
            out[str(item["id"])] = parse_scores(item.get("scores"))
    missing = [i for i in ids if i not in out]
    if missing:
        raise JudgeParseError(f"no scores for candidates {missing}")
    return out


Verdict = Literal["A", "B", "tie"]


def parse_pairwise(text: str) -> Verdict:
    raw = _extract(text)
    winner = str(raw.get("winner", "")).strip().upper()
    if winner == "A":
        return "A"
    if winner == "B":
        return "B"
    if winner == "TIE":
        return "tie"
    raise JudgeParseError(f"unknown winner {raw.get('winner')!r}")


def _conversation_text(messages: Sequence[Mapping[str, str]]) -> str:
    lines = []
    for m in messages:
        if m["role"] == "system":
            continue
        who = "TUTOR" if m["role"] == "assistant" else "LEARNER"
        lines.append(f"{who}: {m['content']}")
    return "\n".join(lines)


def judge_dialogue(
    record: DialogueRecord, client: ChatClient, *, max_tokens: int
) -> tuple[JudgeResult, Usage]:
    prompt = _DIALOGUE_PROMPT.format(
        level=record.level.value,
        system_prompt=render_system_prompt(record.context),
        dialogue=dialogue_json(record.turns),
        rubric=RUBRIC,
    )
    completion = client.complete(
        [{"role": "user", "content": prompt}],
        temperature=0.0,
        max_tokens=max_tokens,
        json_output=True,
    )
    return parse_dialogue_judgement(completion.text, client.name), completion.usage


def judge_candidates(
    prompt_messages: Sequence[Mapping[str, str]],
    candidates: Sequence[str],
    *,
    level: str,
    client: ChatClient,
    max_tokens: int,
    seed: int = 0,
) -> tuple[list[JudgeScores], Usage]:
    """Scores for each candidate (in input order); candidates are shown in shuffled order."""
    ids = [chr(ord("A") + i) for i in range(len(candidates))]
    order = list(range(len(candidates)))
    random.Random(seed).shuffle(order)
    shown = "\n".join(f"[{ids[pos]}] {candidates[i]}" for pos, i in enumerate(order))
    prompt = _CANDIDATES_PROMPT.format(
        level=level,
        n=len(candidates),
        system_prompt=prompt_messages[0]["content"],
        conversation=_conversation_text(prompt_messages),
        candidates=shown,
        rubric=RUBRIC,
    )
    completion = client.complete(
        [{"role": "user", "content": prompt}],
        temperature=0.0,
        max_tokens=max_tokens,
        json_output=True,
    )
    by_id = parse_candidate_scores(completion.text, ids)
    scores: list[JudgeScores | None] = [None] * len(candidates)
    for pos, i in enumerate(order):
        scores[i] = by_id[ids[pos]]
    return [s for s in scores if s is not None], completion.usage


@dataclass(frozen=True)
class PairwiseOutcome:
    """Result of a position-swapped comparison: 1 = first wins, 0 = second wins, 0.5 = tie."""

    score: float
    verdicts: tuple[Verdict, Verdict]


def combine_swapped(first_as_a: Verdict, first_as_b: Verdict) -> PairwiseOutcome:
    """Combine two verdicts with positions swapped; disagreement counts as a tie."""
    points = {"A": 1.0, "tie": 0.5, "B": 0.0}
    score = (points[first_as_a] + (1.0 - points[first_as_b])) / 2
    return PairwiseOutcome(score=score, verdicts=(first_as_a, first_as_b))


def judge_pairwise(
    prompt_messages: Sequence[Mapping[str, str]],
    first: str,
    second: str,
    *,
    level: str,
    client: ChatClient,
    max_tokens: int = 300,
) -> tuple[PairwiseOutcome, Usage]:
    """Compare two tutor turns twice with positions swapped, to cancel position bias."""
    usage = Usage()
    verdicts: list[Verdict] = []
    for a, b in ((first, second), (second, first)):
        prompt = _PAIRWISE_PROMPT.format(
            level=level,
            system_prompt=prompt_messages[0]["content"],
            conversation=_conversation_text(prompt_messages),
            a=a,
            b=b,
            rubric=RUBRIC,
        )
        completion = client.complete(
            [{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=max_tokens,
            json_output=True,
        )
        usage = usage + completion.usage
        verdicts.append(parse_pairwise(completion.text))
    return combine_swapped(verdicts[0], verdicts[1]), usage


def scores_to_wire(scores: JudgeScores) -> dict[str, float]:
    return {wire: float(getattr(scores, py)) for wire, py in _KEYS.items()}
