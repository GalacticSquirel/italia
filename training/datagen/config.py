"""Data-generation configuration (YAML, camelCase keys, `${ENV_VAR}` expansion)."""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel

from datagen.lemmas import TRAINING_DIR
from datagen.teacher import ModelEndpoint
from spec.levels import Level

_ENV = re.compile(r"\$\{([A-Z0-9_]+)(?::-([^${}]*))?\}")


class ConfigModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")


class TurnRange(ConfigModel):
    min: int = Field(default=8, ge=4)
    max: int = Field(default=16, le=24)

    @model_validator(mode="after")
    def _ordered(self) -> TurnRange:
        if self.min > self.max:
            raise ValueError("turns.min must be <= turns.max")
        return self


class LearnerConfig(ConfigModel):
    error_rate: dict[Level, float] = Field(
        default_factory=lambda: {
            Level.A1: 0.55,
            Level.A2: 0.5,
            Level.B1: 0.4,
            Level.B2: 0.3,
            Level.C1: 0.25,
            Level.C2: 0.2,
        },
        description="Probability that a learner turn contains an error, by level.",
    )
    second_error_rate: float = Field(default=0.15, ge=0, le=1)
    self_correct_rate: dict[Level, float] = Field(
        default_factory=lambda: {
            Level.A1: 0.45,
            Level.A2: 0.5,
            Level.B1: 0.6,
            Level.B2: 0.65,
            Level.C1: 0.7,
            Level.C2: 0.75,
        },
        description="Probability the learner fixes an error after a prompt.",
    )
    tag_weights: dict[str, float] = Field(
        default_factory=dict, description="Relative weight per error tag (default 1)."
    )
    focus_boost: float = Field(default=3.0, ge=1, description="Weight multiplier for focus tags.")
    history_boost: float = Field(default=2.0, ge=1)
    max_history_items: int = Field(default=3, ge=0, le=5)
    level_mix: dict[Level, float] = Field(
        default_factory=lambda: {Level.A1: 0.3, Level.A2: 0.3, Level.B1: 0.25, Level.B2: 0.15}
    )


class FilterConfig(ConfigModel):
    max_reply_chars: int = 400
    band_slack: float = Field(default=0.0, ge=0, description="Added to each band's OOB ratio.")
    sentence_slack_words: int = Field(default=3, ge=0)
    max_lt_errors_per_100_words: float = 1.0
    min_policy_agreement: float = Field(default=0.8, ge=0, le=1)
    max_english_ratio: float = 0.1


class LanguageToolConfig(ConfigModel):
    enabled: bool = True
    url: str = "http://localhost:8010/v2"


class JudgeConfig(ConfigModel):
    endpoint: ModelEndpoint | None = Field(
        default=None, description="Judge model; defaults to the teacher endpoint."
    )
    temperature: float = 0.0
    max_tokens: int = 1200
    min_overall: float = Field(default=3.8, description="Dialogues below this are dropped.")


class TokenEstimate(ConfigModel):
    chars_per_token: float = Field(default=3.4, gt=0)
    tutor_turn_tokens: dict[Level, int] = Field(
        default_factory=lambda: {
            Level.A1: 110,
            Level.A2: 130,
            Level.B1: 160,
            Level.B2: 190,
            Level.C1: 220,
            Level.C2: 250,
        }
    )
    learner_turn_tokens: dict[Level, int] = Field(
        default_factory=lambda: {
            Level.A1: 15,
            Level.A2: 22,
            Level.B1: 32,
            Level.B2: 45,
            Level.C1: 60,
            Level.C2: 75,
        }
    )
    judge_output_tokens: int = 350
    expected_pass_rate: float = Field(default=0.7, gt=0, le=1)


class DatagenConfig(ConfigModel):
    name: str
    seed: int = 20261115
    output_dir: Path
    split: Literal["train", "eval"] = "train"
    target_dialogues: int = Field(ge=1)
    turns: TurnRange = TurnRange()
    teacher: ModelEndpoint
    teacher_temperature: float = 0.9
    teacher_max_tokens: int = 8000
    revise_pass: bool = Field(default=True, description="Second teacher pass: critique and fix.")
    max_attempts: int = Field(default=3, ge=1)
    repair_attempts: int = Field(
        default=1,
        ge=0,
        description="Repair turns per draft: validation errors are sent back to the teacher.",
    )
    learner: LearnerConfig = LearnerConfig()
    filters: FilterConfig = FilterConfig()
    language_tool: LanguageToolConfig = LanguageToolConfig()
    judge: JudgeConfig = JudgeConfig()
    estimate: TokenEstimate = TokenEstimate()
    lemma_file: Path | None = None
    scenarios: list[str] = Field(
        default_factory=list, description="Restrict to these scenario ids (empty: all in split)."
    )

    @property
    def judge_endpoint(self) -> ModelEndpoint:
        return self.judge.endpoint or self.teacher


def expand_env(value: object) -> object:
    """Recursively replace `${VAR}` and `${VAR:-default}` (nestable) in strings."""
    if isinstance(value, str):

        def sub(match: re.Match[str]) -> str:
            name, default = match.group(1), match.group(2)
            found = os.environ.get(name)
            if found is not None:
                return found
            if default is not None:
                return default
            raise KeyError(f"environment variable {name} is not set (used in config)")

        # Innermost references first, so `${A:-${B:-x}}` nests.
        previous = None
        while previous != value:
            previous, value = value, _ENV.sub(sub, value)
        return value
    if isinstance(value, dict):
        return {k: expand_env(v) for k, v in value.items()}
    if isinstance(value, list):
        return [expand_env(v) for v in value]
    return value


def deep_merge(base: dict[str, object], override: dict[str, object]) -> dict[str, object]:
    out = dict(base)
    for key, value in override.items():
        current = out.get(key)
        if isinstance(current, dict) and isinstance(value, dict):
            out[key] = deep_merge(current, value)
        else:
            out[key] = value
    return out


def load_raw(path: Path) -> dict[str, object]:
    """YAML with an optional `extends: other.yaml` (relative to this file), deep-merged."""
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError(f"{path}: expected a mapping")
    parent = raw.pop("extends", None)
    if parent is None:
        return raw
    return deep_merge(load_raw(path.parent / str(parent)), raw)


def load_config(path: Path) -> DatagenConfig:
    """Load a config; a relative `outputDir` is resolved against the `training/` folder."""
    raw = load_raw(path)
    config = DatagenConfig.model_validate(expand_env(raw))
    if not config.output_dir.is_absolute():
        config = config.model_copy(update={"output_dir": TRAINING_DIR / config.output_dir})
    return config
