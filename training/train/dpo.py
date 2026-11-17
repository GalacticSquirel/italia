"""Direct preference optimisation on judge-ranked pairs, starting from the SFT model.

    # Apple Silicon (MLX):
    uv run python -m train.dpo -c train/configs/mlx/dpo-gemma4-e4b.yaml
    # NVIDIA (TRL):
    uv run python -m train.dpo -c train/configs/dpo-gemma4-e4b.yaml
    uv run accelerate launch --config_file train/configs/accelerate-fsdp-8gpu.yaml \\
        -m train.dpo -c train/configs/dpo-gemma4-e4b.yaml
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
from collections.abc import Mapping
from pathlib import Path
from typing import Any

from train.common import (
    load_full_model,
    load_rows,
    load_tokenizer,
    prepare_messages,
    seed_everything,
)
from train.config import DpoConfig, load_dpo_config, trainer_arguments

log = logging.getLogger("train.dpo")


def split_pairs(
    rows: list[dict[str, Any]], val_fraction: float, seed: int
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Stable split by dialogue (all pairs of one prompt stay on the same side)."""
    train: list[dict[str, Any]] = []
    val: list[dict[str, Any]] = []
    for row in rows:
        group = str(row.get("id", "")).split(":")[0]
        digest = hashlib.sha256(f"{seed}:{group}".encode()).digest()
        bucket = int.from_bytes(digest[:8], "big") / 2**64
        (val if bucket < val_fraction else train).append(row)
    return train, val


def to_trl_rows(rows: list[dict[str, Any]], config: DpoConfig) -> list[dict[str, Any]]:
    """Conversational DPO rows, with the system prompt merged if the template needs it."""
    out = []
    for row in rows:
        out.append(
            {
                "prompt": prepare_messages(row["prompt"], config.base_model),
                "chosen": row["chosen"],
                "rejected": row["rejected"],
            }
        )
    return out


def dpo_arguments(config: DpoConfig) -> dict[str, Any]:
    """`trl.DPOConfig` keyword arguments (TRL 1.15: loss types combine with loss weights)."""
    args = trainer_arguments(config)
    loss_type: list[str] = [config.loss_type]
    weights = [1.0]
    if config.sft_loss_weight > 0:
        loss_type.append("sft")
        weights.append(config.sft_loss_weight)
    args.update(
        {
            "beta": config.beta,
            "loss_type": loss_type,
            "loss_weights": weights,
            "max_length": config.max_length,
        }
    )
    return args


def fits(
    tokenizer: Any, row: Mapping[str, Any], max_length: int, kwargs: Mapping[str, Any]
) -> bool:
    """True when prompt plus the longer answer fit; TRL would otherwise cut the answer off."""
    longest = max(len(row["chosen"][0]["content"]), len(row["rejected"][0]["content"]))
    answer = {"role": "assistant", "content": "x" * longest}
    ids = tokenizer.apply_chat_template(
        [*row["prompt"], answer], tokenize=True, add_generation_prompt=False, **kwargs
    )
    if isinstance(ids, Mapping):
        ids = ids["input_ids"]
    return len(ids) <= max_length


def run(config: DpoConfig) -> Path:
    from datasets import Dataset
    from trl import DPOConfig, DPOTrainer

    seed_everything(config.seed, config.deterministic)
    rows = load_rows(config.pairs_file)
    train_rows, val_rows = split_pairs(rows, config.val_fraction, config.seed)
    log.info("DPO: %d train pairs, %d val pairs", len(train_rows), len(val_rows))
    tokenizer = load_tokenizer(config.base_model, str(config.policy_model))
    peft_config = None
    if config.method == "lora":
        from peft import LoraConfig

        assert config.lora is not None
        peft_config = LoraConfig(
            r=config.lora.r,
            lora_alpha=config.lora.alpha,
            lora_dropout=config.lora.dropout,
            target_modules=config.lora.target_modules,
            task_type="CAUSAL_LM",
        )
    # The policy starts from the merged SFT weights; TRL uses a frozen copy (or the adapter-off
    # model for LoRA) as the reference.
    model = load_full_model(config.base_model, str(config.policy_model))
    kwargs = config.base_model.chat_template_kwargs
    before = len(train_rows) + len(val_rows)
    train_rows = [
        r for r in to_trl_rows(train_rows, config) if fits(tokenizer, r, config.max_length, kwargs)
    ]
    val_rows = [
        r for r in to_trl_rows(val_rows, config) if fits(tokenizer, r, config.max_length, kwargs)
    ]
    log.info("dropped %d over-long pairs", before - len(train_rows) - len(val_rows))
    args = dpo_arguments(config)
    if not val_rows:
        args["eval_strategy"] = "no"
    trainer = DPOTrainer(
        model=model,
        args=DPOConfig(**args),
        train_dataset=Dataset.from_list(train_rows),
        eval_dataset=Dataset.from_list(val_rows) if val_rows else None,
        processing_class=tokenizer,
        peft_config=peft_config,
    )
    trainer.train()
    final = config.output_dir / "final"
    trainer.save_model(str(final))
    tokenizer.save_pretrained(str(final))
    (final / "italia-train-config.json").write_text(
        json.dumps(config.model_dump(mode="json", by_alias=True), indent=2)
    )
    return final


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    parser = argparse.ArgumentParser(prog="python -m train.dpo")
    parser.add_argument("-c", "--config", required=True)
    parser.add_argument("--no-resume", action="store_true", help="MLX: ignore checkpoints")
    parser.add_argument(
        "--set",
        action="append",
        default=[],
        metavar="KEY=VALUE",
        help="override a config value, e.g. optim.perDeviceBatchSize=4 (repeatable)",
    )
    args = parser.parse_args(argv)
    config = load_dpo_config(Path(args.config), args.set)
    if config.backend == "mlx":
        from train.mlx_dpo import run as run_mlx

        print(f"saved {run_mlx(config, resume=not args.no_resume)}")
    else:
        print(f"saved {run(config)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
