"""Direct preference optimisation on Apple Silicon with MLX.

    uv run python -m train.dpo -c train/configs/mlx/dpo-gemma4-e4b.yaml

Implemented here rather than with a third-party MLX trainer because our pairs have multi-turn
prompts (earlier tutor turns are context, not targets), we add an optional NLL term on the chosen
answer, and the masking must match the SFT stage exactly. The reference model's log-probabilities
are computed once before training and cached in `<outputDir>/reference_logps.json`, so only one
copy of the model is ever in memory.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Sequence
from pathlib import Path
from typing import Any

from train.common import load_rows, prepare_messages
from train.config import DpoConfig
from train.dpo import split_pairs
from train.lineage import is_mlx_output, write_lineage
from train.mlx_core import (
    FitSpec,
    batch_arrays,
    dpo_loss,
    evaluate_batches,
    fit,
    hf_tokenizer,
    load_trained,
    save_weights,
    set_trainable,
    token_logps,
)
from train.mlx_sft import pad_id
from train.schedule import config_digest
from train.tokenize import TokenizedExample, tokenize_completion

log = logging.getLogger("train.mlx_dpo")

MAX_VAL_PAIRS = 256


class PairBatcher:
    """Chosen and rejected answers of each pair, batched as [chosen..., rejected...]."""

    def __init__(
        self,
        chosen: Sequence[TokenizedExample],
        rejected: Sequence[TokenizedExample],
        pad_id: int,
    ) -> None:
        if len(chosen) != len(rejected):
            raise ValueError("chosen and rejected must pair up")
        self.chosen = list(chosen)
        self.rejected = list(rejected)
        self.pad_id = pad_id

    def __len__(self) -> int:
        return len(self.chosen)

    @property
    def lengths(self) -> list[int]:
        return [
            max(len(c.input_ids), len(r.input_ids))
            for c, r in zip(self.chosen, self.rejected, strict=True)
        ]

    def arrays(
        self, indices: Sequence[int], reference: Sequence[tuple[float, float]] | None = None
    ) -> tuple[Any, ...]:
        import mlx.core as mx

        examples = [self.chosen[i] for i in indices] + [self.rejected[i] for i in indices]
        tokens, mask = batch_arrays(examples, self.pad_id)
        if reference is None:
            return tokens, mask
        ref = [reference[i][0] for i in indices] + [reference[i][1] for i in indices]
        return tokens, mask, mx.array(ref, dtype=mx.float32)


def reference_logps(model: Any, batcher: PairBatcher, batch_size: int) -> list[tuple[float, float]]:
    """Summed log-probabilities of each chosen and rejected answer under the frozen model."""
    import mlx.core as mx

    out: list[tuple[float, float]] = []
    for start in range(0, len(batcher), batch_size):
        indices = list(range(start, min(start + batch_size, len(batcher))))
        tokens, mask = batcher.arrays(indices)
        logps = (token_logps(model, tokens) * mask).sum(axis=1)
        mx.eval(logps)
        values = logps.tolist()
        n = len(indices)
        out.extend(zip(values[:n], values[n:], strict=True))
    return out


def make_loss(beta: float, loss_type: str, sft_weight: float) -> Any:
    def loss_fn(model: Any, tokens: Any, mask: Any, reference: Any) -> tuple[Any, Any, Any]:
        import mlx.core as mx

        per_token = token_logps(model, tokens) * mask
        logps = per_token.sum(axis=1)
        ref = reference
        if loss_type == "ipo":  # IPO compares average per-token log-probabilities
            counts = mx.maximum(mask.sum(axis=1), 1)
            logps = logps / counts
            ref = ref / counts
        half = tokens.shape[0] // 2
        loss, aux = dpo_loss(
            logps[:half], logps[half:], ref[:half], ref[half:], beta=beta, loss_type=loss_type
        )
        chosen_tokens = mx.maximum(mask[:half].sum(), 1)
        nll = -per_token[:half].sum() / chosen_tokens
        aux["nll_chosen"] = nll
        if sft_weight > 0:
            loss = loss + sft_weight * nll
        return loss, mask.sum(), aux

    return loss_fn


def tokenize_pairs(
    rows: list[dict[str, Any]], tokenizer: Any, config: DpoConfig
) -> tuple[list[TokenizedExample], list[TokenizedExample]]:
    chosen: list[TokenizedExample] = []
    rejected: list[TokenizedExample] = []
    dropped = 0
    kwargs = config.base_model.chat_template_kwargs
    for row in rows:
        prompt = prepare_messages(row["prompt"], config.base_model)
        c = tokenize_completion(
            tokenizer,
            prompt,
            row["chosen"][0],
            max_length=config.max_length,
            template_kwargs=kwargs,
        )
        r = tokenize_completion(
            tokenizer,
            prompt,
            row["rejected"][0],
            max_length=config.max_length,
            template_kwargs=kwargs,
        )
        if c is None or r is None:
            dropped += 1
            continue
        chosen.append(c)
        rejected.append(r)
    if dropped:
        log.info("dropped %d over-long pairs", dropped)
    return chosen, rejected


def cached_reference(path: Path, digest: str, compute: Any) -> dict[str, list[tuple[float, float]]]:
    if path.exists():
        cached = json.loads(path.read_text(encoding="utf-8"))
        if cached.get("digest") == digest:
            log.info("reusing reference log-probabilities from %s", path)
            return {k: [tuple(p) for p in v] for k, v in cached["values"].items()}
    values: dict[str, list[tuple[float, float]]] = compute()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"digest": digest, "values": values}), encoding="utf-8")
    return values


def run(config: DpoConfig, *, resume: bool = True) -> Path:
    if config.policy_model and not is_mlx_output(config.policy_model):
        raise FileNotFoundError(
            f"{config.policy_model} is not an MLX training output; run the MLX SFT stage first"
        )
    dumped = config.model_dump(mode="json", by_alias=True)
    digest = config_digest(dumped)
    model, tokenizer, base = load_trained(config.policy_model)
    if (base.id, base.revision) != (config.base_model.id, config.base_model.revision):
        raise ValueError(
            f"{config.policy_model} was trained from {base.id}, not the configured base"
        )
    tok = hf_tokenizer(tokenizer)
    train_rows, val_rows = split_pairs(
        load_rows(config.pairs_file), config.val_fraction, config.seed
    )
    pad = pad_id(tok)
    train = PairBatcher(*tokenize_pairs(train_rows, tok, config), pad_id=pad)
    val_c, val_r = tokenize_pairs(val_rows, tok, config)
    val = PairBatcher(val_c[:MAX_VAL_PAIRS], val_r[:MAX_VAL_PAIRS], pad_id=pad)
    log.info("DPO: %d train pairs, %d val pairs", len(train), len(val))
    bs = config.optim.per_device_batch_size

    def compute() -> dict[str, list[tuple[float, float]]]:
        log.info("scoring %d pairs with the reference model", len(train) + len(val))
        return {
            "train": reference_logps(model, train, bs),
            "val": reference_logps(model, val, bs) if len(val) else [],
        }

    reference = cached_reference(config.output_dir / "reference_logps.json", digest, compute)
    set_trainable(model, config.method, config.lora, config.base_model.freeze_patterns)
    loss_fn = make_loss(config.beta, config.loss_type, config.sft_loss_weight)
    val_batches = [
        val.arrays(list(range(i, min(i + bs, len(val)))), reference["val"])
        for i in range(0, len(val), bs)
    ]
    spec = FitSpec(
        output_dir=config.output_dir,
        optim=config.optim,
        settings=config.mlx,
        lengths=train.lengths,
        batch_size=bs,
        seed=config.seed,
        save_every=config.save_steps,
        eval_every=config.eval_steps,
        log_every=config.logging_steps,
        grad_checkpoint=config.gradient_checkpointing,
        config_digest=digest,
    )
    fit(
        model,
        spec,
        loss_fn,
        lambda indices: train.arrays(indices, reference["train"]),
        (lambda m: evaluate_batches(m, val_batches, loss_fn)) if val_batches else None,
        resume=resume,
    )
    final = config.output_dir / "final"
    final.mkdir(parents=True, exist_ok=True)
    save_weights(model, final / "weights.safetensors")
    write_lineage(
        final,
        stage="dpo",
        base=config.base_model,
        method=config.method,
        lora=config.lora,
        parent=config.policy_model,
        config=dumped,
    )
    return final
