"""The judge's per-turn grammar check: cleanup rules, verification, and scoring."""

from __future__ import annotations

import functools
import json
from collections.abc import Callable, Sequence

import pytest

from datagen.config import JudgeConfig
from datagen.grammar_check import (
    check_dialogue,
    grammaticality_score,
    keep_flag,
    quoted_spans,
)
from datagen.judge import JudgeParseError, judge_dialogue
from datagen.records import DialogueRecord, JudgeResult
from datagen.teacher import ScriptedClient
from spec.models import Turn
from spec.render import ChatMessage
from tests.helpers import make_record, output

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
NO_ERRORS = '{"errors": []}'


def judge(
    find: Callable[[str], str], *, verdict: str = '{"definitelyWrong": true}'
) -> ScriptedClient:
    """A scripted judge: the rubric gets all 5s, find steps go to `find(reply)`."""

    def respond(messages: Sequence[ChatMessage]) -> str:
        content = messages[0]["content"]
        if "<tutor_instructions>" in content:
            return RUBRIC_ALL_FIVES
        if "Claimed mistake" in content:
            return verdict
        reply = content.split("<reply>")[1].split("</reply>")[0]
        return find(reply)

    return ScriptedClient(respond)


def with_last_reply(record: DialogueRecord, reply: str) -> DialogueRecord:
    turns = list(record.turns)
    i = max(j for j, t in enumerate(turns) if t.output is not None)
    turns[i] = Turn.tutor(output(reply))
    return record.model_copy(update={"turns": turns})


def flag_on(text: str, quote: str, fix: str) -> Callable[[str], str]:
    def find(reply: str) -> str:
        if text in reply:
            return json.dumps({"errors": [{"quote": quote, "fix": fix}]})
        return NO_ERRORS

    return find


def test_keep_flag_drops_echoes_mentions_and_non_corrections() -> None:
    reply = "Ho andato? Sei sicuro? Non si dice 'la arancia'. Ci sono un balcone."
    keep = functools.partial(
        keep_flag,
        reply=reply,
        learner_turns=["Ieri io ho andato al bar."],
        annotated_spans=["ho andato"],
    )
    assert keep("Ci sono un balcone", "C'è un balcone")
    assert not keep("Ho andato", "Sono andato")  # learner echo / annotated span
    assert not keep("la arancia", "l'arancia")  # mention in quotes
    # judges usually quote the whole sentence, quote marks included
    assert not keep("Non si dice 'la arancia'.", "Non si dice 'l'arancia'.")
    assert not keep("un giardino", "il giardino")  # not in the reply
    assert not keep("Sei sicuro", "Sei sicuro")  # changes nothing


def test_quoted_spans_ignore_elisions() -> None:
    reply = "Non dica 'ho visto lo', dica 'l'ho visto'. L'albergo è «bello»."
    assert quoted_spans(reply) == ["ho visto lo", "l'ho visto", "bello"]


def test_grammaticality_score_one_error_is_below_the_floor() -> None:
    assert [grammaticality_score(n) for n in range(5)] == [5.0, 3.0, 2.0, 1.0, 1.0]
    assert grammaticality_score(1) < JudgeConfig().min_scores["grammaticality"]


def test_confirmed_mistake_is_recorded_with_its_turn() -> None:
    record = with_last_reply(make_record(), "E ci sono un balcone o un giardino?")
    errors, _ = check_dialogue(record, judge(flag_on("balcone", "ci sono un balcone", "c'è")))
    assert len(errors) == 1
    assert errors[0].quote == "ci sono un balcone"
    assert record.turns[errors[0].turn].text == "E ci sono un balcone o un giardino?"


def test_unconfirmed_flag_is_dropped() -> None:
    record = with_last_reply(make_record(), "E ci sono un balcone o un giardino?")
    client = judge(
        flag_on("balcone", "ci sono un balcone", "c'è"), verdict='{"definitelyWrong": false}'
    )
    errors, _ = check_dialogue(record, client)
    assert errors == []


def test_prompt_echo_is_never_sent_for_verification() -> None:
    # plan-following dialogues prompt with "Ho andato? Sei sicuro?" on the learner's "ho andato"
    record = make_record()
    client = judge(flag_on("Ho andato", "Ho andato", "Sono andato"))
    errors, _ = check_dialogue(record, client)
    assert errors == []
    assert not any("Claimed mistake" in call[0]["content"] for call in client.calls)


def test_unreadable_find_answer_is_a_parse_error() -> None:
    record = make_record()
    with pytest.raises(JudgeParseError, match="grammar check"):
        judge_dialogue(record, judge(lambda reply: "no idea"), max_tokens=100, grammar_check=True)


def test_judge_scores_grammaticality_from_the_check() -> None:
    record = with_last_reply(make_record(), "Il problema e che la machina non parte.")
    client = judge(flag_on("machina", "la machina", "la macchina"))
    clean, _ = judge_dialogue(record, client, max_tokens=100)  # rubric only: all 5s
    checked, usage = judge_dialogue(record, client, max_tokens=100, grammar_check=True)
    config = JudgeConfig()
    assert clean.scores.grammaticality == 5 and config.accepts(clean.scores)
    assert checked.scores.grammaticality == 3 and not config.accepts(checked.scores)
    assert [e.quote for e in checked.grammar_errors] == ["la machina"]
    assert any("la machina" in issue for issue in checked.issues)
    assert usage.output_tokens > 0


def test_old_judgements_without_grammar_errors_still_load() -> None:
    old = json.loads(RUBRIC_ALL_FIVES) | {"judge": "x"}
    assert JudgeResult.model_validate(old).grammar_errors == []
