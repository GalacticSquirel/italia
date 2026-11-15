"""Training configuration (YAML, camelCase keys) and the pure helpers built on it.

Three backends train the same data with the same loss masks:

- `mlx`: Apple Silicon (the primary path, a Mac Studio); SFT and DPO both run on MLX.
- `unsloth` / `transformers`: NVIDIA GPUs (rented or local); DPO there uses TRL (`trl`).

Nothing here imports torch or MLX; the entry points import their heavy dependencies lazily so this
module and its tests run anywhere.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel

from datagen.config import load_raw
from datagen.lemmas import TRAINING_DIR


class TrainModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, extra="forbid", protected_namespaces=()
    )


class LoraConfig(TrainModel):
    r: int = Field(default=64, ge=1)
    alpha: int = Field(default=64, ge=1)
    dropout: float = Field(default=0.0, ge=0, lt=1)
    target_modules: list[str] | Literal["all-linear"] = "all-linear"
    dora: bool = Field(default=False, description="Weight-decomposed LoRA (mlx, transformers).")
    num_layers: int = Field(
        default=-1, description="MLX: adapt only the last N transformer blocks (-1: all)."
    )

    @property
    def scale(self) -> float:
        """MLX parameterises LoRA by scale = alpha / r (PEFT's convention, made explicit)."""
        return self.alpha / self.r


class MlxSettings(TrainModel):
    """Apple Silicon specifics. Defaults suit a Mac Studio with 64 GB or more."""

    wired_limit_gb: float | None = Field(
        default=None,
        description="Raise MLX's wired-memory limit (GB); also needs `sudo sysctl "
        "iogpu.wired_limit_mb=...` on macOS. None keeps MLX's recommended limit.",
    )
    clear_cache_every: int = Field(
        default=50, ge=0, description="Free MLX's buffer cache every N steps (0: never)."
    )
    keep_checkpoints: int = Field(default=3, ge=1)
    max_tokens_per_batch: int | None = Field(
        default=None,
        ge=256,
        description="Cap padded tokens per micro-batch (long dialogues get smaller batches).",
    )


class BaseModelConfig(TrainModel):
    id: str = Field(description="Hugging Face model id or local path.")
    revision: str | None = Field(default=None, description="Pin a commit for reproducibility.")
    loader: Literal["causal-lm", "image-text-to-text"] = Field(
        default="causal-lm",
        description="Auto class for full fine-tuning; multimodal checkpoints need the second.",
    )
    freeze_patterns: list[str] = Field(
        default_factory=list,
        description="Parameter-name substrings to freeze (vision/audio towers).",
    )
    licence: str = "Apache-2.0"
    system_role: Literal["native", "merge"] = Field(
        default="native",
        description="'merge' prepends the system prompt to the first user turn.",
    )
    chat_template_kwargs: dict[str, Any] = Field(
        default_factory=dict,
        description="Passed to apply_chat_template, e.g. {enable_thinking: false} for Qwen.",
    )


class WandbConfig(TrainModel):
    enabled: bool = False
    project: str = "italia-tutor"


class OptimConfig(TrainModel):
    learning_rate: float = Field(gt=0)
    epochs: float = Field(default=2.0, gt=0)
    per_device_batch_size: int = Field(default=4, ge=1)
    gradient_accumulation_steps: int = Field(default=4, ge=1)
    warmup_ratio: float = Field(default=0.03, ge=0, lt=1)
    weight_decay: float = Field(default=0.0, ge=0)
    lr_scheduler: Literal["cosine", "linear", "constant_with_warmup"] = "cosine"
    optimizer: str = "adamw_torch_fused"
    max_grad_norm: float = 1.0


class SftConfig(TrainModel):
    stage: Literal["sft"] = "sft"
    name: str
    seed: int = 20261115
    deterministic: bool = Field(
        default=False, description="Fully deterministic kernels (slower); seeds are always set."
    )
    base_model: BaseModelConfig
    method: Literal["full", "lora"]
    backend: Literal["mlx", "unsloth", "transformers"] = Field(
        description="mlx on Apple Silicon; on NVIDIA, unsloth for LoRA iteration and "
        "transformers (+ accelerate FSDP) for full fine-tuning."
    )
    mlx: MlxSettings = MlxSettings()
    lora: LoraConfig | None = None
    load_in_4bit: bool = False
    train_file: Path
    val_file: Path | None = None
    max_seq_length: int = Field(default=4096, ge=256)
    max_train_examples: int | None = Field(
        default=None, description="Stable subset (bake-off on the first 5k dialogues)."
    )
    optim: OptimConfig
    gradient_checkpointing: bool = True
    bf16: bool = True
    output_dir: Path
    logging_steps: int = 10
    eval_steps: int = 200
    save_steps: int = 500
    save_total_limit: int = 3
    wandb: WandbConfig = WandbConfig()

    @model_validator(mode="after")
    def _consistent(self) -> SftConfig:
        if self.method == "lora" and self.lora is None:
            raise ValueError("method lora needs a lora section")
        if self.method == "full" and self.lora is not None:
            raise ValueError("method full must not have a lora section")
        if self.method == "full" and self.backend == "unsloth" and self.load_in_4bit:
            raise ValueError("full fine-tuning cannot load the base in 4-bit")
        if self.backend == "mlx" and self.load_in_4bit:
            raise ValueError("the mlx backend trains a bf16 base; loadIn4Bit is for unsloth")
        if self.lora is not None and self.lora.dora and self.backend == "unsloth":
            raise ValueError("DoRA needs the mlx or transformers backend")
        return self


class DpoConfig(TrainModel):
    stage: Literal["dpo"] = "dpo"
    name: str
    seed: int = 20261115
    deterministic: bool = False
    policy_model: Path = Field(description="The SFT output (merged weights or LoRA adapter).")
    base_model: BaseModelConfig
    backend: Literal["trl", "mlx"] = Field(
        default="trl", description="trl on NVIDIA GPUs; mlx on Apple Silicon."
    )
    mlx: MlxSettings = MlxSettings()
    method: Literal["full", "lora"]
    lora: LoraConfig | None = None
    pairs_file: Path
    val_fraction: float = Field(default=0.03, ge=0, lt=1)
    beta: float = Field(default=0.1, gt=0)
    loss_type: Literal["sigmoid", "ipo", "robust"] = "sigmoid"
    sft_loss_weight: float = Field(
        default=0.0, ge=0, description="Add an SFT (NLL) term on chosen; guards against drift."
    )
    max_length: int = Field(
        default=4096, description="Pairs whose prompt + answer exceed this are dropped."
    )
    optim: OptimConfig
    gradient_checkpointing: bool = True
    bf16: bool = True
    output_dir: Path
    logging_steps: int = 10
    eval_steps: int = 100
    save_steps: int = 250
    wandb: WandbConfig = WandbConfig()

    @model_validator(mode="after")
    def _consistent(self) -> DpoConfig:
        if self.method == "lora" and self.lora is None:
            raise ValueError("method lora needs a lora section")
        return self


def _resolve(path: Path) -> Path:
    return path if path.is_absolute() else TRAINING_DIR / path


def apply_overrides(raw: dict[str, Any], overrides: Sequence[str]) -> dict[str, Any]:
    """Apply `dotted.key=yaml-value` overrides (e.g. `optim.perDeviceBatchSize=4`) in place."""
    for item in overrides:
        key, sep, value = item.partition("=")
        if not sep or not key:
            raise ValueError(f"override {item!r} is not key=value")
        *parents, leaf = key.split(".")
        target = raw
        for part in parents:
            child = target.setdefault(part, {})
            if not isinstance(child, dict):
                raise ValueError(f"override {item!r}: {part} is not a section")
            target = child
        target[leaf] = yaml.safe_load(value)
    return raw


def load_sft_config(path: Path, overrides: Sequence[str] = ()) -> SftConfig:
    config = SftConfig.model_validate(apply_overrides(load_raw(path), overrides))
    return config.model_copy(
        update={
            "train_file": _resolve(config.train_file),
            "val_file": _resolve(config.val_file) if config.val_file else None,
            "output_dir": _resolve(config.output_dir),
        }
    )


def load_dpo_config(path: Path, overrides: Sequence[str] = ()) -> DpoConfig:
    config = DpoConfig.model_validate(apply_overrides(load_raw(path), overrides))
    return config.model_copy(
        update={
            "policy_model": _resolve(config.policy_model),
            "pairs_file": _resolve(config.pairs_file),
            "output_dir": _resolve(config.output_dir),
        }
    )


def effective_batch_size(optim: OptimConfig, world_size: int = 1) -> int:
    return optim.per_device_batch_size * optim.gradient_accumulation_steps * world_size


def total_steps(n_examples: int, optim: OptimConfig, world_size: int = 1) -> int:
    per_epoch = math.ceil(n_examples / effective_batch_size(optim, world_size))
    return math.ceil(per_epoch * optim.epochs)


def report_to(wandb: WandbConfig) -> list[str]:
    return ["wandb"] if wandb.enabled else []


def trainer_arguments(config: SftConfig | DpoConfig) -> dict[str, Any]:
    """Keyword arguments shared by `transformers.TrainingArguments` and TRL's configs."""
    optim = config.optim
    args: dict[str, Any] = {
        "output_dir": str(config.output_dir),
        "seed": config.seed,
        "data_seed": config.seed,
        "full_determinism": config.deterministic,
        "learning_rate": optim.learning_rate,
        "num_train_epochs": optim.epochs,
        "per_device_train_batch_size": optim.per_device_batch_size,
        "per_device_eval_batch_size": optim.per_device_batch_size,
        "gradient_accumulation_steps": optim.gradient_accumulation_steps,
        # transformers 5 reads a float in [0, 1) here as a ratio of total steps.
        "warmup_steps": optim.warmup_ratio,
        "weight_decay": optim.weight_decay,
        "lr_scheduler_type": optim.lr_scheduler,
        "optim": optim.optimizer,
        "max_grad_norm": optim.max_grad_norm,
        "bf16": config.bf16,
        "gradient_checkpointing": config.gradient_checkpointing,
        "logging_steps": config.logging_steps,
        "eval_strategy": "steps",
        "eval_steps": config.eval_steps,
        "save_strategy": "steps",
        "save_steps": config.save_steps,
        "report_to": report_to(config.wandb),
        "run_name": config.name,
        "remove_unused_columns": False,
    }
    if isinstance(config, SftConfig):
        args["save_total_limit"] = config.save_total_limit
    return args
