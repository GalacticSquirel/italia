"""Backend-neutral training bookkeeping: micro-batches, step counts, learning rate, checkpoints.

The MLX backend runs its own loop (the GPU backends use the Hugging Face Trainer), so the parts
that decide *what* happens at each step live here as plain Python and are tested without MLX:
which examples form each micro-batch, how many optimizer steps a run has, the learning rate at
each step, and where checkpoints go so an interrupted run resumes exactly where it stopped.
"""

from __future__ import annotations

import hashlib
import json
import math
import random
import shutil
from collections.abc import Iterator, Sequence
from dataclasses import asdict, dataclass
from pathlib import Path

from train.config import OptimConfig


def length_batches(
    lengths: Sequence[int],
    batch_size: int,
    *,
    seed: int,
    epoch: int,
    max_tokens: int | None = None,
) -> list[list[int]]:
    """Micro-batches of similar-length examples (little padding), in a per-epoch random order.

    A batch closes at `batch_size` examples, or earlier when its padded size (longest x count)
    would exceed `max_tokens`. The grouping is fixed; only the order changes between epochs.
    """
    order = sorted(range(len(lengths)), key=lambda i: (lengths[i], i))
    batches: list[list[int]] = []
    current: list[int] = []
    for index in order:
        too_many = len(current) >= batch_size
        too_wide = max_tokens is not None and lengths[index] * (len(current) + 1) > max_tokens
        if current and (too_many or too_wide):
            batches.append(current)
            current = []
        current.append(index)
    if current:
        batches.append(current)
    random.Random(f"{seed}:{epoch}").shuffle(batches)
    return batches


@dataclass(frozen=True)
class RunLength:
    batches_per_epoch: int
    grad_accum: int
    epochs: float

    @property
    def micro_steps(self) -> int:
        """Total micro-batches, rounded up to whole optimizer steps."""
        raw = math.ceil(self.batches_per_epoch * self.epochs)
        return math.ceil(raw / self.grad_accum) * self.grad_accum

    @property
    def optimizer_steps(self) -> int:
        return self.micro_steps // self.grad_accum


def micro_batches(
    length: RunLength,
    *,
    seed: int,
    lengths: Sequence[int],
    batch_size: int,
    max_tokens: int | None = None,
    start: int = 0,
) -> Iterator[tuple[int, list[int]]]:
    """Yield (micro_step, example indices) from `start` to the end of the run.

    Epoch k uses `length_batches(..., epoch=k)`, so resuming at any micro-step reproduces the
    batches an uninterrupted run would have seen.
    """
    per_epoch = length.batches_per_epoch
    cache: dict[int, list[list[int]]] = {}
    for step in range(start, length.micro_steps):
        epoch, position = divmod(step, per_epoch)
        if epoch not in cache:
            cache.clear()
            cache[epoch] = length_batches(
                lengths, batch_size, seed=seed, epoch=epoch, max_tokens=max_tokens
            )
        yield step, cache[epoch][position]


def warmup_steps(optim: OptimConfig, total_steps: int) -> int:
    return math.ceil(optim.warmup_ratio * total_steps)


def learning_rate(step: int, optim: OptimConfig, total_steps: int) -> float:
    """LR for optimizer step `step` (0-based): linear warmup, then cosine, linear or constant."""
    peak = optim.learning_rate
    warmup = warmup_steps(optim, total_steps)
    if step < warmup:
        return peak * (step + 1) / warmup
    if optim.lr_scheduler == "constant_with_warmup":
        return peak
    span = max(total_steps - warmup, 1)
    progress = min((step - warmup) / span, 1.0)
    if optim.lr_scheduler == "linear":
        return peak * (1.0 - progress)
    return peak * 0.5 * (1.0 + math.cos(math.pi * progress))


def mlx_optimizer(name: str) -> str:
    """Map the configs' optimizer names (Hugging Face spellings) to an MLX optimizer class."""
    lowered = name.lower()
    if lowered.startswith("adamw"):
        return "AdamW"
    if lowered.startswith("adam"):
        return "Adam"
    if lowered.startswith("adafactor"):
        return "Adafactor"
    if lowered.startswith("sgd"):
        return "SGD"
    raise ValueError(f"no MLX optimizer for {name!r}")


# --- checkpoints -------------------------------------------------------------------------------

STATE_FILE = "state.json"
WEIGHTS_FILE = "weights.safetensors"
OPTIMIZER_FILE = "optimizer.safetensors"


@dataclass(frozen=True)
class TrainState:
    """Progress saved with every checkpoint (written last, so its presence marks completeness)."""

    micro_step: int
    optimizer_step: int
    trained_tokens: int = 0
    config_digest: str = ""

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2)

    @classmethod
    def from_json(cls, text: str) -> TrainState:
        data = json.loads(text)
        return cls(**data)


def checkpoint_dir(output_dir: Path, optimizer_step: int) -> Path:
    return output_dir / "checkpoints" / f"step-{optimizer_step:07d}"


def list_checkpoints(output_dir: Path) -> list[tuple[int, Path]]:
    """Complete checkpoints (with a state file), oldest first."""
    root = output_dir / "checkpoints"
    if not root.is_dir():
        return []
    found = []
    for path in root.iterdir():
        if path.name.startswith("step-") and (path / STATE_FILE).exists():
            try:
                found.append((int(path.name.removeprefix("step-")), path))
            except ValueError:
                continue
    return sorted(found)


def latest_checkpoint(output_dir: Path) -> Path | None:
    checkpoints = list_checkpoints(output_dir)
    return checkpoints[-1][1] if checkpoints else None


def prune_checkpoints(output_dir: Path, keep: int) -> list[Path]:
    """Delete all but the newest `keep` complete checkpoints. Returns what was removed."""
    removed = []
    for _step, path in list_checkpoints(output_dir)[:-keep]:
        shutil.rmtree(path)
        removed.append(path)
    return removed


def config_digest(config: dict[str, object]) -> str:
    """Identifies the settings a checkpoint was written with (resume refuses a mismatch)."""
    text = json.dumps(config, sort_keys=True, default=str)
    return hashlib.sha256(text.encode()).hexdigest()[:16]
