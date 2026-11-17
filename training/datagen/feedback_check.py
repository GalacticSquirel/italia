"""Per-turn feedback check for the dialogue judge (feedback and promptWithholds).

Like grammaticality, the rubric's feedback and promptWithholds numbers were 5 for every round-1
dialogue, including a planted prompt that hands over the answer ("La cucina piccolo? Si dice: la
cucina piccola."). The tutor's rules (spec/system_prompt.v1.txt): correct nothing when the
learner made no error; address only the most important error; a prompt repeats the wrong part as
a question or gives a short hint and leaves the correction to the learner.

Every tutor turn that carries a prompt or a recast annotation is assessed on its own:
1. the judge answers in JSON: what is the correct form of the annotated learner text
   (and whether it is wrong), does the reply give the correction away (prompts only, quoting where),
   and which other
   learner mistakes does the reply also correct (quoting them);
2. deterministic checks: a prompt reveals the answer when the full correct form appears in the
   reply (and differs from what the learner wrote); quotes must be in the reply;
3. every judge-made flag is confirmed with a yes/no question (the deterministic one is not).

feedback is scored from confirmed "corrects-correct" and "multiple" problems, promptWithholds from
confirmed "reveals" problems, with the same mapping as grammaticality (one problem is below the
default floor of 4).
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, Literal

from datagen.grammar_check import ask_json, normalize, scene
from datagen.jsonutil import JsonExtractError, extract_json_object
from datagen.records import DialogueRecord, FeedbackKind, FeedbackProblem
from datagen.teacher import ChatClient, Usage
from spec.models import Turn

ASSESS_PROMPT = """\
You are reviewing how an Italian tutor handled a learner's mistake in a role-play lesson.
Scene: {setting} The tutor plays {tutor_role}; the learner plays {learner_role} ({gender}).

The tutor's rules: if the learner made no mistake, correct nothing. Otherwise address only the
most important mistake. A PROMPT repeats the wrong part as a question or gives a short hint and
must leave the correction to the learner: it must not contain the correct form or the correct
alternative. A RECAST uses the correct form naturally in the reply.

Learner's message: <learner>{learner}</learner>
Tutor's reply ({move}): <reply>{reply}</reply>
The tutor marked this learner text as the mistake: "{learner_text}"

Answer with JSON only:
{{"learnerTextWrong": true or false,
  "correctForm": "<the marked learner text, corrected>",
  "givesAnswer": "<exact words of the reply that state the correct form or alternative, or empty>",
  "otherCorrections": ["<exact words of the reply that correct a DIFFERENT learner mistake>"]}}
Leave "givesAnswer" empty for a recast, and when the reply only repeats the mistake or hints.
"otherCorrections" includes learner words the tutor silently fixed while repeating them (for
example "al la mercato" given back as "al mercato")."""

CONFIRM_REVEALS = """\
An Italian tutor PROMPTED a learner to self-correct "{learner_text}" (correct form: "{correct}").
Tutor's reply: <reply>{reply}</reply>
Do the words "{quote}" tell the learner the correct form or the correct alternative, so they no
longer have to find it themselves? A question that only repeats the mistake, or a hint that does
not contain the answer, is fine.
Answer with JSON only: {{"answer": true}} or {{"answer": false}}"""

CONFIRM_NOT_WRONG = """\
A learner of Italian wrote: <learner>{learner}</learner>
Is "{learner_text}" in that message a real mistake in standard Italian (grammar, spelling,
agreement, word form)? Answer false only if it is fully correct as written.
Answer with JSON only: {{"answer": true}} or {{"answer": false}}"""

CONFIRM_MULTIPLE = """\
Learner's message: <learner>{learner}</learner>
Tutor's reply: <reply>{reply}</reply>
The tutor meant to correct only "{learner_text}". Do the words "{quote}" in the reply correct a
DIFFERENT mistake that the learner really made (not just reuse correct words)?
Answer with JSON only: {{"answer": true}} or {{"answer": false}}"""

ASSESS_MAX_TOKENS = 300
CONFIRM_MAX_TOKENS = 40


def reveals_deterministically(
    reply: str, learner_text: str, correct_form: str, learner_message: str
) -> bool:
    """A prompt gives the answer away when the whole corrected span is in the reply. The span
    must add something the learner did not write ("Prendiamo la regionale" for "Noi prendiamo la
    regionale" only drops a word, so repeating it reveals nothing)."""
    fixed = normalize(correct_form)
    if not fixed or fixed == normalize(learner_text):
        return False
    if f" {fixed} " in f" {normalize(learner_message)} ":
        return False
    return f" {fixed} " in f" {normalize(reply)} "


def in_reply(quote: str, reply: str) -> bool:
    q = normalize(quote)
    return bool(q) and q in normalize(reply)


def feedback_score(n_problems: int) -> float:
    """5 with no problem; one confirmed problem is 3, below the default floor of 4."""
    return {0: 5.0, 1: 3.0, 2: 2.0}.get(n_problems, 1.0)


def _confirm(client: ChatClient, prompt: str) -> tuple[bool, Usage]:
    completion = client.complete(
        [{"role": "user", "content": prompt}],
        temperature=0.0,
        max_tokens=CONFIRM_MAX_TOKENS,
        json_output=True,
    )
    try:
        answer = extract_json_object(completion.text).get("answer", True)
    except JsonExtractError:
        answer = True  # an unreadable verdict keeps the flag
    return answer is not False, completion.usage


def _learner_before(turns: Sequence[Turn], index: int) -> str:
    for turn in reversed(turns[:index]):
        if turn.output is None:
            return turn.text
    return ""


@dataclass(frozen=True)
class _FeedbackTurn:
    """One prompt or recast turn, with the judge's assess answer."""

    index: int
    move: Literal["prompt", "recast"]
    reply: str
    learner: str
    learner_text: str
    correct: str
    intended: frozenset[str]
    answer: dict[str, Any]


def _problem(t: _FeedbackTurn, kind: FeedbackKind, quote: str, note: str) -> FeedbackProblem:
    return FeedbackProblem(turn=t.index, kind=kind, quote=quote, note=note)


def _corrects_correct(t: _FeedbackTurn, client: ChatClient) -> tuple[list[FeedbackProblem], Usage]:
    # Asked on its own, without "the tutor marked this as the mistake", which the assess answer
    # tends to agree with (it called a correct "sono andato" wrong). It misses some mistakes
    # that only show in context ("Io chiamo Marco", "Faccio una decisione"); a
    # rewrite-the-whole-message check did not fix those with this judge and was dropped.
    ok, usage = _confirm(
        client, CONFIRM_NOT_WRONG.format(learner=t.learner, learner_text=t.learner_text)
    )
    if ok:
        return [], usage
    return [_problem(t, "corrects-correct", t.learner_text, f"{t.move} on correct text")], usage


def _reveals(t: _FeedbackTurn, client: ChatClient) -> tuple[list[FeedbackProblem], Usage]:
    if t.move != "prompt":
        return [], Usage()
    if reveals_deterministically(t.reply, t.learner_text, t.correct, t.learner):
        return [
            _problem(t, "reveals", t.correct, "the prompt contains the corrected form")
        ], Usage()
    quote = str(t.answer.get("givesAnswer") or "")
    if not in_reply(quote, t.reply) or normalize(quote) == normalize(t.learner_text):
        return [], Usage()
    ok, usage = _confirm(
        client,
        CONFIRM_REVEALS.format(
            learner_text=t.learner_text, correct=t.correct, reply=t.reply, quote=quote
        ),
    )
    return ([_problem(t, "reveals", quote, f"gives away '{t.correct}'")] if ok else []), usage


def _multiple(t: _FeedbackTurn, client: ChatClient) -> tuple[list[FeedbackProblem], Usage]:
    problems: list[FeedbackProblem] = []
    usage = Usage()
    others = t.answer.get("otherCorrections") or []
    for quote in (str(q) for q in others if isinstance(q, str)):
        if not in_reply(quote, t.reply) or normalize(quote) in t.intended:
            continue  # not in the reply, or it is the intended correction itself
        ok, cost = _confirm(
            client,
            CONFIRM_MULTIPLE.format(
                learner=t.learner, reply=t.reply, learner_text=t.learner_text, quote=quote
            ),
        )
        usage = usage + cost
        if ok:
            problems.append(_problem(t, "multiple", quote, "also corrects another mistake"))
    return problems, usage


def check_dialogue(
    record: DialogueRecord, client: ChatClient
) -> tuple[list[FeedbackProblem], Usage]:
    """Confirmed feedback problems in prompt and recast turns, with the judge usage they cost."""
    ctx = scene(record)
    usage = Usage()
    problems: list[FeedbackProblem] = []
    for index, turn in enumerate(record.turns):
        if turn.output is None:
            continue
        ann = turn.output.annotations
        feedback = ann.prompt or ann.recast
        if feedback is None:
            continue
        move: Literal["prompt", "recast"] = "prompt" if ann.prompt is not None else "recast"
        learner = _learner_before(record.turns, index)
        answer, cost = ask_json(
            client,
            ASSESS_PROMPT.format(
                setting=ctx["setting"],
                tutor_role=ctx["tutor_role"],
                learner_role=ctx["learner_role"],
                gender=ctx["gender"],
                learner=learner,
                reply=turn.output.reply,
                move=move.upper(),
                learner_text=feedback.learner_text,
            ),
            max_tokens=ASSESS_MAX_TOKENS,
            what="feedback check",
            required="learnerTextWrong",
            kind=bool,
        )
        usage = usage + cost
        correct = str(answer.get("correctForm") or "")
        intended = {normalize(correct)}
        if ann.recast is not None:
            intended.add(normalize(ann.recast.corrected_text))
        case = _FeedbackTurn(
            index=index,
            move=move,
            reply=turn.output.reply,
            learner=learner,
            learner_text=feedback.learner_text,
            correct=correct,
            intended=frozenset(intended),
            answer=answer,
        )
        for check in (_corrects_correct, _reveals, _multiple):
            found, cost = check(case, client)
            problems += found
            usage = usage + cost
    return problems, usage


def scores_from(problems: Sequence[FeedbackProblem], has_prompt: bool) -> dict[str, float | None]:
    """feedback and promptWithholds from the confirmed problems (None: no prompt to judge)."""
    feedback = sum(p.kind in ("corrects-correct", "multiple") for p in problems)
    reveals = sum(p.kind == "reveals" for p in problems)
    return {
        "feedback": feedback_score(feedback),
        "prompt_withholds": feedback_score(reveals) if has_prompt else None,
    }
