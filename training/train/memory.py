"""Rough peak-memory estimates for MLX training on unified memory, and per-RAM-tier settings.

These are planning numbers, not guarantees: they count bf16 weights, gradients and AdamW state for
the trainable parameters, the logits of one micro-batch (large for Gemma's 262k vocabulary), and
activations with gradient checkpointing. Each run logs MLX's measured peak memory to
`metrics.jsonl`; trust that over this table once you have it.

    uv run python -m train.memory            # the table for every model, method and RAM tier
    uv run python -m train.memory --ram 128  # one tier
"""

from __future__ import annotations

import argparse
import math
from dataclasses import dataclass
from typing import Literal

Method = Literal["lora", "full"]
GB = 1e9


@dataclass(frozen=True)
class ModelSpec:
    """Language-model part only (MLX drops the vision and audio towers when it loads)."""

    name: str
    lm_params_b: float
    embedding_params_b: float  # token (and per-layer) embeddings; frozen in our full-FT configs
    hidden: int
    layers: int
    intermediate: int
    vocab: int


# Approximate shapes: parameter counts from the bf16 checkpoint sizes on Hugging Face
# (E4B 16.0 GB, E2B 10.2 GB, Qwen3.5-4B 9.3 GB including vision/audio towers).
MODELS: dict[str, ModelSpec] = {
    "gemma4-e4b": ModelSpec("gemma4-e4b", 7.4, 3.4, 2560, 42, 10240, 262_144),
    "gemma4-e2b": ModelSpec("gemma4-e2b", 4.6, 2.3, 1536, 35, 6144, 262_144),
    "qwen35-4b": ModelSpec("qwen35-4b", 4.3, 0.65, 2560, 32, 9216, 248_320),
}

RAM_TIERS = (64, 96, 128, 192, 256, 512)
EFFECTIVE_BATCH = 16


@dataclass(frozen=True)
class Estimate:
    weights_gb: float
    optimizer_gb: float
    logits_gb: float
    activations_gb: float

    @property
    def total_gb(self) -> float:
        # 10% allocator slack plus ~2 GB for the Python process and Metal command buffers.
        return (
            1.1 * (self.weights_gb + self.optimizer_gb + self.logits_gb + self.activations_gb) + 2.0
        )


def lora_params_b(spec: ModelSpec, rank: int) -> float:
    attention = 4 * rank * (spec.hidden + spec.hidden)  # q, k, v, o (approximate widths)
    mlp = 3 * rank * (spec.hidden + spec.intermediate)  # gate, up, down
    return spec.layers * (attention + mlp) / 1e9


def estimate(
    spec: ModelSpec,
    method: Method,
    *,
    batch: int,
    seq_len: int = 4096,
    rank: int = 64,
    dpo: bool = False,
    grad_checkpoint: bool = True,
    train_embeddings: bool = False,
) -> Estimate:
    weights = spec.lm_params_b * 2
    if method == "full":
        trainable = spec.lm_params_b - (0.0 if train_embeddings else spec.embedding_params_b)
        weights_extra = 0.0
    else:
        trainable = lora_params_b(spec, rank)
        weights_extra = trainable * 2
    # bf16 gradients + AdamW first and second moments (MLX keeps them in the parameter dtype).
    optimizer = trainable * (2 + 4) + weights_extra
    sequences = batch * (2 if dpo else 1)  # DPO scores chosen and rejected in one pass
    tokens = sequences * seq_len
    logits = tokens * spec.vocab * 10 / GB  # bf16 logits + fp32 log-softmax + its gradient
    per_layer_io = tokens * spec.hidden * 2 / GB
    one_layer = tokens * (spec.hidden * 12 + spec.intermediate * 4) * 2 / GB
    layers = per_layer_io * spec.layers + one_layer
    if not grad_checkpoint:
        layers = one_layer * spec.layers
    return Estimate(weights, optimizer, logits, layers)


def usable_gb(ram_gb: int, raised_limit: bool = False) -> float:
    """macOS lets the GPU wire about 75% of RAM by default; `sysctl iogpu.wired_limit_mb` raises
    it (leave ~8 GB for the OS)."""
    return ram_gb - 8.0 if raised_limit else ram_gb * 0.75


@dataclass(frozen=True)
class TierSetting:
    ram_gb: int
    model: str
    method: Method
    batch: int  # 0: does not fit
    grad_accum: int
    peak_gb: float


def recommend(
    spec: ModelSpec,
    method: Method,
    ram_gb: int,
    *,
    seq_len: int = 4096,
    dpo: bool = False,
    raised_limit: bool = False,
) -> TierSetting:
    """Largest power-of-two micro-batch (up to 8) that fits; accumulation keeps 16 per step."""
    budget = usable_gb(ram_gb, raised_limit)
    chosen = 0
    peak = estimate(spec, method, batch=1, seq_len=seq_len, dpo=dpo).total_gb
    for batch in (1, 2, 4, 8):
        total = estimate(spec, method, batch=batch, seq_len=seq_len, dpo=dpo).total_gb
        if total <= budget:
            chosen, peak = batch, total
    accum = math.ceil(EFFECTIVE_BATCH / chosen) if chosen else 0
    return TierSetting(ram_gb, spec.name, method, chosen, accum, round(peak, 1))


def table(ram_tiers: tuple[int, ...] = RAM_TIERS, *, dpo: bool = False) -> str:
    stage = "DPO" if dpo else "SFT"
    lines = [
        f"| {stage} model / method | " + " | ".join(f"{r} GB" for r in ram_tiers) + " |",
        "|---|" + "---|" * len(ram_tiers),
    ]
    for spec in MODELS.values():
        for method in ("lora", "full"):
            cells = []
            for ram in ram_tiers:
                s = recommend(spec, method, ram, dpo=dpo)
                if s.batch:
                    cells.append(f"bs {s.batch} x{s.grad_accum} (~{s.peak_gb:.0f} GB)")
                else:
                    cells.append(f"no (~{s.peak_gb:.0f} GB at bs 1)")
            lines.append(f"| {spec.name} {method} | " + " | ".join(cells) + " |")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m train.memory")
    parser.add_argument("--ram", type=int, action="append", help="RAM tier(s) in GB")
    args = parser.parse_args(argv)
    tiers = tuple(args.ram) if args.ram else RAM_TIERS
    print(table(tiers))
    print()
    print(table(tiers, dpo=True))
    print("\nsequence length 4096, LoRA rank 64, gradient checkpointing on, default wired limit")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
