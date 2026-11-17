"""Per-criterion judge floors: one failed criterion rejects a dialogue the mean would accept."""

from __future__ import annotations

import pytest

from datagen.config import JudgeConfig
from datagen.records import JudgeScores


def scores(**overrides: float | None) -> JudgeScores:
    values: dict[str, float | None] = {
        "grammaticality": 5,
        "level_fit": 5,
        "feedback": 5,
        "annotation_accuracy": 5,
        "scenario": 5,
        "tone": 5,
        "prompt_withholds": 5,
    }
    values.update(overrides)
    return JudgeScores(**values)  # type: ignore[arg-type]


def test_mean_alone_would_accept_a_grammar_failure() -> None:
    bad = scores(grammaticality=2)
    assert bad.overall > 4.5
    assert not JudgeConfig().accepts(bad)


@pytest.mark.parametrize("criterion", ["grammaticality", "feedback", "prompt_withholds"])
def test_each_default_floor_rejects(criterion: str) -> None:
    assert not JudgeConfig().accepts(scores(**{criterion: 3}))
    assert JudgeConfig().accepts(scores(**{criterion: 4}))


def test_unasked_prompt_criterion_has_no_floor() -> None:
    assert JudgeConfig().accepts(scores(prompt_withholds=None))


def test_mean_threshold_still_applies() -> None:
    low = scores(level_fit=1, scenario=1, tone=1, annotation_accuracy=2)
    assert low.overall < 3.8
    assert not JudgeConfig().accepts(low)


def test_floors_are_configurable_and_validated() -> None:
    config = JudgeConfig.model_validate({"minScores": {"tone": 4}})
    assert config.accepts(scores(grammaticality=2))
    assert not config.accepts(scores(tone=3))
    with pytest.raises(ValueError, match="unknown judge criteria"):
        JudgeConfig.model_validate({"minScores": {"grammar": 4}})
