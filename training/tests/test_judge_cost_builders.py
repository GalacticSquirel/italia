from __future__ import annotations

import json
from pathlib import Path

import pytest

from datagen.builders import (
    Candidate,
    CandidateSet,
    build_dpo_prompts,
    build_preference_pairs,
    build_sft,
)
from datagen.cost import estimate_cost
from datagen.judge import (
    JudgeParseError,
    combine_swapped,
    judge_candidates,
    judge_dialogue,
    judge_pairwise,
    parse_candidate_scores,
    parse_dialogue_judgement,
    parse_pairwise,
)
from datagen.learner import build_jobs
from datagen.records import JudgeScores
from datagen.teacher import ScriptedClient
from spec.levels import Level
from spec.scenarios import load_library
from tests.helpers import make_config, make_record, output

SCORES = (
    '{"grammaticality": 5, "levelFit": 4, "feedback": 4, "annotationAccuracy": 5,'
    ' "scenario": 4, "tone": 5}'
)


def scores(value: float) -> JudgeScores:
    return JudgeScores(
        grammaticality=value,
        level_fit=value,
        feedback=value,
        annotation_accuracy=value,
        scenario=value,
        tone=value,
    )


def test_parse_dialogue_judgement_tolerates_prose_and_clamps() -> None:
    raw = {"scores": {**json.loads(SCORES), "grammaticality": 9}, "issues": ["turn 3: too long"]}
    text = "Sure!\n```json\n" + json.dumps(raw) + "\n```"
    result = parse_dialogue_judgement(text, "j")
    assert result.scores.grammaticality == 5.0  # clamped from 9
    assert result.issues == ["turn 3: too long"]
    assert result.overall == pytest.approx((5 + 4 + 4 + 5 + 4 + 5) / 6)


def test_parse_dialogue_judgement_errors() -> None:
    with pytest.raises(JudgeParseError, match="missing scores"):
        parse_dialogue_judgement('{"scores": {"grammaticality": 3}}')
    with pytest.raises(JudgeParseError, match="not a number"):
        parse_dialogue_judgement(json.dumps({"scores": {**json.loads(SCORES), "tone": "x"}}))
    with pytest.raises(JudgeParseError):
        parse_dialogue_judgement("no json here")


def test_parse_pairwise_and_combine() -> None:
    assert parse_pairwise('{"winner": "a", "reason": "x"}') == "A"
    assert parse_pairwise('{"winner": "Tie"}') == "tie"
    with pytest.raises(JudgeParseError):
        parse_pairwise('{"winner": "C"}')
    assert combine_swapped("A", "B").score == 1.0  # first wins both orders
    assert combine_swapped("B", "A").score == 0.0
    assert combine_swapped("A", "A").score == 0.5  # position bias cancels out
    assert combine_swapped("tie", "tie").score == 0.5


def test_judge_dialogue_and_pairwise_calls() -> None:
    record = make_record()
    client = ScriptedClient([f'{{"scores": {SCORES}, "issues": []}}'])
    result, usage = judge_dialogue(record, client, max_tokens=100)
    assert result.overall > 4 and usage.input_tokens > 0
    assert "<dialogue>" in client.calls[0][0]["content"]
    pair = ScriptedClient(['{"winner": "A"}', '{"winner": "B"}'])
    outcome, _ = judge_pairwise(
        [{"role": "system", "content": "s"}], "x", "y", level="A1", client=pair
    )
    assert outcome.score == 1.0 and len(pair.calls) == 2


def test_judge_candidates_unshuffles() -> None:
    def respond(messages: object) -> str:
        content = messages[0]["content"]  # type: ignore[index]
        # Give the candidate whose text is "best" a 5 and the others a 2, whatever its letter.
        items = []
        for line in content.splitlines():
            if line.startswith("[") and "] " in line:
                letter, text = line[1], line.split("] ", 1)[1]
                value = 5 if text == "best" else 2
                items.append(
                    {
                        "id": letter,
                        "scores": json.loads(
                            SCORES.replace("5", str(value)).replace("4", str(value))
                        ),
                    }
                )
        return json.dumps({"candidates": items})

    client = ScriptedClient(respond)
    result, _ = judge_candidates(
        [{"role": "system", "content": "s"}],
        ["meh", "best", "bad"],
        level="A2",
        client=client,
        max_tokens=100,
        seed=3,
    )
    assert [round(s.overall) for s in result] == [2, 5, 2]
    with pytest.raises(JudgeParseError, match="no scores"):
        parse_candidate_scores('{"candidates": []}', ["A"])


def test_cost_estimate_scales_and_prices(tmp_path: Path) -> None:
    library = load_library()
    scenarios = [s for s in library.values() if s.split == "train"]
    config = make_config(tmp_path, targetDialogues=1000)
    jobs = build_jobs(config, scenarios)
    est = estimate_cost(config, jobs, library, sample_size=50)
    assert [s.name for s in est.stages] == ["generate", "judge"]
    gen = est.stages[0]
    assert gen.calls == 1000
    assert 1_000 < gen.usage.input_tokens / 1000 < 6_000  # brief tokens per dialogue
    assert 600 < gen.usage.output_tokens / 1000 < 3_500
    assert est.total_cost == pytest.approx(sum(s.cost_usd for s in est.stages))
    revised = estimate_cost(
        make_config(tmp_path, targetDialogues=1000, revisePass=True), jobs, library, sample_size=50
    )
    assert [s.name for s in revised.stages] == ["generate", "revise", "judge"]
    assert revised.total_cost > est.total_cost
    assert "total" in revised.table()
    assert estimate_cost(config, [], library).total_cost == 0


def test_build_sft_splits_stably_and_skips_eval() -> None:
    train_records = [make_record(seed=i) for i in range(30)]
    eval_record = make_record("gelateria", Level.A1)
    assert eval_record.split == "eval"
    train, val = build_sft([*train_records, eval_record], val_fraction=0.2, seed=1)
    assert len(train) + len(val) == 30
    assert all(ex["id"] != eval_record.id for ex in train + val)
    again = build_sft(train_records, val_fraction=0.2, seed=1)
    assert [e["id"] for e in again[1]] == [e["id"] for e in val]
    messages = train[0]["messages"]
    assert messages[0]["role"] == "system" and messages[-1]["role"] == "assistant"
    limited, _ = build_sft(train_records, val_fraction=0.0, max_dialogues=5)
    assert len(limited) == 5


def test_build_dpo_prompts_end_on_learner_turn() -> None:
    record = make_record()
    prompts = build_dpo_prompts([record], per_dialogue=2, seed=0)
    assert 1 <= len(prompts) <= 2
    for p in prompts:
        assert p.messages[-1]["role"] == "user"
        k = int(p.id.rsplit(":", 1)[1])
        assert p.expected_move == record.plan[k].expected_move
        reference = record.turns[2 * (k + 1)].output
        assert reference is not None and p.reference == reference.to_json()
    assert any(p.expected_move != "none" for p in prompts)


def test_preference_pairs() -> None:
    prompt = build_dpo_prompts([make_record()], per_dialogue=1)[0]
    good = output("Bene! E poi?").to_json()
    ok = output("Va bene.").to_json()
    sets = [
        CandidateSet(
            prompt=prompt,
            candidates=[
                Candidate(text="not json", source="student", scores=scores(5)),
                Candidate(text=ok, source="student", scores=scores(4.5)),
                Candidate(text=good, source="reference", scores=scores(4.8)),
            ],
        )
    ]
    pairs = build_preference_pairs(sets, min_margin=0.5, min_chosen_score=4.0)
    assert len(pairs) == 1  # 4.8 vs 4.2 is below the margin; invalid JSON scores 0
    assert pairs[0]["chosen"][0]["content"] == good
    assert pairs[0]["rejected"][0]["content"] == "not json"
    assert pairs[0]["prompt"] == prompt.messages
    assert build_preference_pairs(sets, min_chosen_score=4.9) == []
    assert len(build_preference_pairs(sets, min_margin=0.5, max_pairs_per_prompt=0)) == 0
    assert len(build_preference_pairs(sets, min_margin=0.1)) == 2
