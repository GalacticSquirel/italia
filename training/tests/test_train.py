from __future__ import annotations

from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

import pytest
from pydantic import ValidationError

from train.common import prepare_messages, stable_subset
from train.config import (
    DpoConfig,
    OptimConfig,
    SftConfig,
    effective_batch_size,
    load_dpo_config,
    load_sft_config,
    total_steps,
    trainer_arguments,
)
from train.dpo import dpo_arguments, fits, split_pairs, to_trl_rows
from train.tokenize import (
    IGNORE_INDEX,
    TemplateMismatchError,
    merge_system_message,
    pad_batch,
    tokenize_conversation,
)

CONFIG_DIR = Path(__file__).resolve().parents[1] / "train" / "configs"


class ToyTokenizer:
    """Character-level 'tokenizer' with a Gemma-like turn template."""

    def __init__(self, unstable: bool = False) -> None:
        self.unstable = unstable

    def render(self, messages: Sequence[Mapping[str, str]], gen: bool) -> str:
        text = "<bos>" + "".join(f"<{m['role']}>{m['content']}<end>" for m in messages)
        if self.unstable and messages:
            text += f"#{len(messages)}"
        return text + ("<assistant>" if gen else "")

    def apply_chat_template(
        self,
        conversation: Sequence[Mapping[str, str]],
        *,
        tokenize: bool,
        add_generation_prompt: bool,
        **kwargs: Any,
    ) -> list[int]:
        assert tokenize
        return [ord(c) for c in self.render(conversation, add_generation_prompt)]


MESSAGES = [
    {"role": "system", "content": "S"},
    {"role": "user", "content": "go"},
    {"role": "assistant", "content": "A1"},
    {"role": "user", "content": "u"},
    {"role": "assistant", "content": "A2"},
]


def decode(ids: list[int]) -> str:
    return "".join(chr(i) for i in ids if i != IGNORE_INDEX)


def test_assistant_only_labels() -> None:
    example = tokenize_conversation(ToyTokenizer(), MESSAGES, max_length=10_000)
    assert example is not None
    assert len(example.input_ids) == len(example.labels)
    trained = decode(example.labels)
    # Only the assistant contents and their end markers are trained.
    assert trained == "A1<end>A2<end>"
    assert decode(example.input_ids).startswith("<bos><system>S<end>")


def test_truncation_and_empty_examples() -> None:
    # The prompt before the first answer is 43 characters long.
    short = tokenize_conversation(ToyTokenizer(), MESSAGES, max_length=50)
    assert short is not None and len(short.input_ids) == 50
    assert decode(short.labels) == "A1<end>"
    assert tokenize_conversation(ToyTokenizer(), MESSAGES, max_length=10) is None


def test_template_mismatch_is_detected() -> None:
    with pytest.raises(TemplateMismatchError):
        tokenize_conversation(ToyTokenizer(unstable=True), MESSAGES, max_length=1000)


def test_pad_batch() -> None:
    a = tokenize_conversation(ToyTokenizer(), MESSAGES, max_length=1000)
    b = tokenize_conversation(ToyTokenizer(), MESSAGES[:3], max_length=1000)
    assert a is not None and b is not None
    batch = pad_batch([a, b], pad_token_id=0)
    width = len(a.input_ids)
    assert all(len(row) == width for rows in batch.values() for row in rows)
    assert batch["attention_mask"][1].count(1) == len(b.input_ids)
    assert batch["labels"][1][-1] == IGNORE_INDEX


def test_merge_system_message() -> None:
    merged = merge_system_message(MESSAGES)
    assert merged[0] == {"role": "user", "content": "S\n\ngo"}
    assert len(merged) == len(MESSAGES) - 1
    assert merge_system_message([{"role": "system", "content": "S"}]) == [
        {"role": "user", "content": "S"}
    ]


def test_shipped_configs_load() -> None:
    sft = [load_sft_config(p) for p in sorted(CONFIG_DIR.glob("sft-*.yaml"))]
    bake = [load_sft_config(p) for p in sorted(CONFIG_DIR.glob("bakeoff-*.yaml"))]
    dpo = [load_dpo_config(p) for p in sorted(CONFIG_DIR.glob("dpo-*.yaml"))]
    assert len(sft) == 4 and len(bake) == 2 and len(dpo) == 2
    assert {c.method for c in sft} == {"full", "lora"}
    assert all(c.wandb.enabled is False for c in [*sft, *bake])
    assert all(c.wandb.enabled is False for c in dpo)
    assert all(c.max_train_examples == 5000 for c in bake)
    qwen = next(c for c in bake if "qwen" in c.name)
    assert qwen.base_model.id == "Qwen/Qwen3.5-4B"
    assert qwen.base_model.chat_template_kwargs == {"enable_thinking": False}
    assert qwen.base_model.freeze_patterns == []
    assert all(c.output_dir.is_absolute() and c.train_file.is_absolute() for c in sft)
    e2b = next(c for c in dpo if "e2b" in c.name)
    assert "E2B" in e2b.base_model.id and "e2b" in str(e2b.policy_model)


def test_config_validation() -> None:
    base = {
        "name": "x",
        "baseModel": {"id": "m"},
        "trainFile": "a",
        "outputDir": "o",
        "optim": {"learningRate": 1e-5},
        "backend": "transformers",
    }
    with pytest.raises(ValidationError, match="lora section"):
        SftConfig.model_validate({**base, "method": "lora"})
    with pytest.raises(ValidationError, match="must not have"):
        SftConfig.model_validate({**base, "method": "full", "lora": {}})
    with pytest.raises(ValidationError, match="maxPromptLength"):
        DpoConfig.model_validate(
            {
                "name": "d",
                "policyModel": "p",
                "baseModel": {"id": "m"},
                "method": "full",
                "pairsFile": "x",
                "optim": {"learningRate": 1e-6},
                "outputDir": "o",
                "maxLength": 100,
                "maxPromptLength": 100,
            }
        )


def test_trainer_arguments_and_steps() -> None:
    config = load_sft_config(CONFIG_DIR / "sft-gemma4-e4b-full.yaml")
    args = trainer_arguments(config)
    assert args["seed"] == args["data_seed"] == config.seed
    assert args["report_to"] == []
    assert args["learning_rate"] == 1e-5 and args["bf16"] is True
    wandb = config.model_copy(update={"wandb": config.wandb.model_copy(update={"enabled": True})})
    assert trainer_arguments(wandb)["report_to"] == ["wandb"]
    optim = OptimConfig(
        learning_rate=1, per_device_batch_size=2, gradient_accumulation_steps=4, epochs=2
    )
    assert effective_batch_size(optim, world_size=8) == 64
    assert total_steps(40_000, optim, world_size=8) == 1250


def test_dpo_helpers() -> None:
    config = load_dpo_config(CONFIG_DIR / "dpo-gemma4-e4b.yaml")
    args = dpo_arguments(config)
    assert args["beta"] == 0.1
    assert args["loss_type"] == ["sigmoid", "sft"] and args["loss_weights"] == [1.0, 0.2]
    pair = {
        "prompt": MESSAGES[:4],
        "chosen": [{"role": "assistant", "content": "ab"}],
        "rejected": [{"role": "assistant", "content": "abcd"}],
    }
    assert fits(ToyTokenizer(), pair, 1000, {})
    assert not fits(ToyTokenizer(), pair, 50, {})
    rows = [
        {
            "id": f"d{i}:{k}:0",
            "prompt": MESSAGES[:4],
            "chosen": [{"role": "assistant", "content": "x"}],
            "rejected": [{"role": "assistant", "content": "y"}],
        }
        for i in range(200)
        for k in range(2)
    ]
    train, val = split_pairs(rows, 0.1, seed=1)
    assert len(train) + len(val) == 400 and 10 < len(val) < 80
    val_groups = {r["id"].split(":")[0] for r in val}
    assert not val_groups & {r["id"].split(":")[0] for r in train}
    merged = config.model_copy(
        update={"base_model": config.base_model.model_copy(update={"system_role": "merge"})}
    )
    trl_rows = to_trl_rows(rows[:1], merged)
    assert trl_rows[0]["prompt"][0]["role"] == "user"
    assert prepare_messages(MESSAGES, config.base_model)[0]["role"] == "system"


def test_stable_subset() -> None:
    rows = [{"id": str(i)} for i in range(100)]
    first = stable_subset(rows, 10, seed=3)
    assert first == stable_subset(list(reversed(rows)), 10, seed=3)
    assert len(first) == 10 and stable_subset(rows, None, seed=3) is rows
