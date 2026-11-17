"""The judge's per-turn feedback check, and the JSON retry shared with the grammar check."""

from __future__ import annotations

import json
from collections.abc import Callable, Sequence

import pytest

from datagen.config import JudgeConfig
from datagen.feedback_check import check_dialogue, reveals_deterministically, scores_from
from datagen.grammar_check import RETRY_TEMPERATURE, CheckParseError, ask_json
from datagen.judge import judge_dialogue
from datagen.records import DialogueRecord, FeedbackProblem
from datagen.teacher import Completion, ScriptedClient, Usage
from spec.models import Turn
from spec.render import ChatMessage
from tests.helpers import make_record

RUBRIC_ALL_FIVES = json.dumps(
    {
        "scores": {
            "grammaticality": 5,
            "levelFit": 5,
            "feedback": 5,
            "annotationAccuracy": 5,
            "scenario": 5,
            "tone": 5,
            "promptWithholds": 5,
        },
        "issues": [],
    }
)


def assess(**overrides: object) -> Callable[[str], str]:
    answer = {
        "learnerTextWrong": True,
        "correctForm": "sono andato",
        "givesAnswer": "",
        "otherCorrections": [],
        **overrides,
    }
    return lambda content: json.dumps(answer)


def judge(
    assess_answer: Callable[[str], str],
    *,
    is_mistake: bool = True,
    reveals: bool = True,
    multiple: bool = True,
) -> ScriptedClient:
    """A scripted judge for the rubric and the feedback check's questions."""

    def respond(messages: Sequence[ChatMessage]) -> str:
        content = messages[0]["content"]
        if "<tutor_instructions>" in content:
            return RUBRIC_ALL_FIVES
        if "marked this learner text as the mistake" in content:
            return assess_answer(content)
        if "a real mistake in standard Italian" in content:
            return json.dumps({"answer": is_mistake})
        if "PROMPTED a learner" in content:
            return json.dumps({"answer": reveals})
        if "meant to correct only" in content:
            return json.dumps({"answer": multiple})
        raise AssertionError(f"unexpected judge prompt: {content[:80]}")

    return ScriptedClient(respond)


def first_prompt_turn(record: DialogueRecord) -> int:
    return next(i for i, t in enumerate(record.turns) if t.output and t.output.annotations.prompt)


def with_reply(record: DialogueRecord, index: int, reply: str) -> DialogueRecord:
    turns = list(record.turns)
    old = turns[index].output
    assert old is not None
    turns[index] = Turn(role="tutor", text=reply, output=old.model_copy(update={"reply": reply}))
    return record.model_copy(update={"turns": turns})


def asked(client: ScriptedClient, marker: str) -> int:
    return sum(marker in call[0]["content"] for call in client.calls)


def test_reveals_deterministically() -> None:
    learner = "La cucina è piccolo."
    reply = "La cucina piccolo? Si dice: la cucina piccola."
    assert reveals_deterministically(reply, "cucina è piccolo", "la cucina piccola", learner)
    assert not reveals_deterministically("Piccolo? Sicuro?", "piccolo", "piccola", learner)
    # a "correct form" that only drops a word the learner wrote reveals nothing
    assert not reveals_deterministically(
        "Noi prendiamo la regionale?",
        "Noi prendiamo la regionale",
        "Prendiamo la regionale",
        "Noi prendiamo la regionale.",
    )


def test_clean_prompts_and_recasts_have_no_problems() -> None:
    # plan-following dialogues prompt "Ho andato? Sei sicuro?" and recast "Ah, sei andato al bar!"
    problems, _ = check_dialogue(make_record(), judge(assess()))
    assert problems == []


def test_prompt_containing_the_correct_form_reveals_without_asking() -> None:
    record = make_record()
    i = first_prompt_turn(record)
    client = judge(assess())
    problems, _ = check_dialogue(with_reply(record, i, "Ho andato? Si dice: sono andato."), client)
    assert [(p.turn, p.kind) for p in problems] == [(i, "reveals")]
    assert asked(client, "PROMPTED a learner") == 0  # deterministic, no confirmation needed


def test_judge_flagged_reveal_needs_confirmation() -> None:
    record = make_record()
    i = first_prompt_turn(record)
    reply = "Ho andato? Con andare si usa essere!"
    flagged = assess(givesAnswer="si usa essere")
    confirmed, _ = check_dialogue(with_reply(record, i, reply), judge(flagged, reveals=True))
    rejected, _ = check_dialogue(with_reply(record, i, reply), judge(flagged, reveals=False))
    assert [p.kind for p in confirmed] == ["reveals"]
    assert rejected == []


def test_correcting_correct_learner_text() -> None:
    problems, _ = check_dialogue(make_record(), judge(assess(), is_mistake=False))
    kinds = {p.kind for p in problems}
    assert kinds == {"corrects-correct"}


def test_other_corrections_must_be_in_the_reply_and_confirmed() -> None:
    record = make_record()
    i = first_prompt_turn(record)
    reply = "Ho andato? E si scrive caffè, con l'accento."
    record = with_reply(record, i, reply)
    client = judge(assess(otherCorrections=["si scrive caffè", "not in the reply"]))
    problems, _ = check_dialogue(record, client)
    assert [(p.turn, p.kind, p.quote) for p in problems] == [(i, "multiple", "si scrive caffè")]
    assert asked(client, "meant to correct only") == 1


def test_scores_from_problems() -> None:
    multiple = FeedbackProblem(turn=2, kind="multiple", quote="x")
    reveals = FeedbackProblem(turn=2, kind="reveals", quote="y")
    assert scores_from([], has_prompt=True) == {"feedback": 5.0, "prompt_withholds": 5.0}
    assert scores_from([multiple, reveals], has_prompt=True) == {
        "feedback": 3.0,
        "prompt_withholds": 3.0,
    }
    assert scores_from([], has_prompt=False)["prompt_withholds"] is None


def test_judge_scores_feedback_and_prompt_withholds_from_the_check() -> None:
    record = make_record()
    i = first_prompt_turn(record)
    record = with_reply(record, i, "Ho andato? Si dice: sono andato.")
    client = judge(assess())
    plain, _ = judge_dialogue(record, client, max_tokens=100)
    checked, _ = judge_dialogue(record, client, max_tokens=100, feedback_check=True)
    config = JudgeConfig()
    assert plain.scores.prompt_withholds == 5 and config.accepts(plain.scores)
    assert checked.scores.prompt_withholds == 3 and not config.accepts(checked.scores)
    assert [p.kind for p in checked.feedback_problems] == ["reveals"]
    assert any("reveals" in issue for issue in checked.issues)


class RecordingClient:
    """Answers from a list and records the temperature and prompt of every call."""

    name = "recording"

    def __init__(self, answers: list[str]) -> None:
        self.answers = answers
        self.calls: list[tuple[float, str]] = []

    def complete(
        self,
        messages: Sequence[ChatMessage],
        *,
        temperature: float,
        max_tokens: int,
        json_output: bool = False,
    ) -> Completion:
        self.calls.append((temperature, messages[0]["content"]))
        text = self.answers[len(self.calls) - 1]
        return Completion(text=text, usage=Usage(output_tokens=1), model="recording")


def test_ask_json_retries_once_warmer_and_says_what_was_wrong() -> None:
    client = RecordingClient(['{"correctForm": "a" -> "b"}', '{"errors": []}'])
    answer, usage = ask_json(client, "check", max_tokens=10, what="x", required="errors")
    assert answer == {"errors": []} and usage.output_tokens == 2
    (t0, first), (t1, second) = client.calls
    assert (t0, first) == (0.0, "check")
    assert t1 == RETRY_TEMPERATURE and second.startswith("check") and "not valid JSON" in second


def test_ask_json_gives_up_after_one_retry() -> None:
    client = RecordingClient(["no idea", '{"errors": "none"}', "unused"])
    with pytest.raises(CheckParseError, match="'errors' is not a list"):
        ask_json(client, "check", max_tokens=10, what="x", required="errors")
    assert len(client.calls) == 2
