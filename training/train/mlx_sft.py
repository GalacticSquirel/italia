"""Supervised fine-tuning on Apple Silicon with MLX (LoRA, DoRA or full; loss on tutor turns).

    uv run python -m train.sft -c train/configs/mlx/sft-gemma4-e4b-lora.yaml

Run through `train.sft`, which dispatches on `backend`. Writes `<outputDir>/final/` with the
trained delta (`weights.safetensors`) and its lineage; `python -m export mlx-fuse` turns it into
Hugging Face weights for GGUF conversion. Interrupted runs resume from the newest checkpoint.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from train.common import load_rows, stable_subset
from train.config import SftConfig
from train.lineage import write_lineage
from train.mlx_core import (
    FitSpec,
    batch_arrays,
    evaluate_batches,
    fit,
    hf_tokenizer,
    load_base,
    masked_nll,
    save_weights,
    set_trainable,
)
from train.schedule import config_digest

log = logging.getLogger("train.mlx_sft")

MAX_VAL_EXAMPLES = 256


def pad_id(tokenizer: Any) -> int:
    value = tokenizer.pad_token_id
    if value is None:
        value = tokenizer.eos_token_id
    return int(value)


def sft_loss(model: Any, tokens: Any, mask: Any) -> tuple[Any, Any, dict[str, Any]]:
    loss, ntoks = masked_nll(model, tokens, mask)
    return loss, ntoks, {}


def run(config: SftConfig, *, resume: bool = True) -> Path:
    from train.sft import tokenize_rows

    dumped = config.model_dump(mode="json", by_alias=True)
    model, tokenizer = load_base(config.base_model)
    tok = hf_tokenizer(tokenizer)
    rows = stable_subset(load_rows(config.train_file), config.max_train_examples, config.seed)
    train = tokenize_rows(rows, tok, config)
    val = tokenize_rows(load_rows(config.val_file), tok, config) if config.val_file else []
    val = val[:MAX_VAL_EXAMPLES]
    log.info(
        "train: %d examples, %.1fM trainable tokens",
        len(train),
        sum(e.trainable_tokens for e in train) / 1e6,
    )
    set_trainable(model, config.method, config.lora, config.base_model.freeze_patterns)
    pad = pad_id(tok)
    bs = config.optim.per_device_batch_size

    def make_batch(indices: list[int]) -> tuple[Any, ...]:
        return batch_arrays([train[i] for i in indices], pad)

    val_batches = [batch_arrays(val[i : i + bs], pad) for i in range(0, len(val), bs)]
    spec = FitSpec(
        output_dir=config.output_dir,
        optim=config.optim,
        settings=config.mlx,
        lengths=[len(e.input_ids) for e in train],
        batch_size=bs,
        seed=config.seed,
        save_every=config.save_steps,
        eval_every=config.eval_steps,
        log_every=config.logging_steps,
        grad_checkpoint=config.gradient_checkpointing,
        config_digest=config_digest(dumped),
    )
    fit(
        model,
        spec,
        sft_loss,
        make_batch,
        (lambda m: evaluate_batches(m, val_batches, sft_loss)) if val_batches else None,
        resume=resume,
    )
    return save_final(model, config, dumped)


def save_final(model: Any, config: SftConfig, dumped: dict[str, Any]) -> Path:
    final = config.output_dir / "final"
    final.mkdir(parents=True, exist_ok=True)
    save_weights(model, final / "weights.safetensors")
    write_lineage(
        final,
        stage="sft",
        base=config.base_model,
        method=config.method,
        lora=config.lora,
        parent=None,
        config=dumped,
    )
    (final / "italia-train-config.json").write_text(json.dumps(dumped, indent=2))
    return final
