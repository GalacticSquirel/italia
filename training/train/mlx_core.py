"""MLX building blocks shared by SFT and DPO on Apple Silicon.

- losses: masked next-token NLL (loss only on tutor tokens) and the DPO objective
- adapters: LoRA/DoRA on chosen projections via mlx-lm, fusing, freezing by name
- `load_trained`: rebuild a model from the base plus the deltas named in its lineage
- `fit`: the training loop (gradient accumulation, clipping, LR schedule, periodic eval,
  checkpoints with optimizer state, exact resume, `metrics.jsonl` for monitoring)

Imports of `mlx` and `mlx_lm` happen inside functions so the package imports on any machine.
"""

from __future__ import annotations

import json
import logging
import time
from collections.abc import Callable, Sequence
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any, cast

from train.config import BaseModelConfig, LoraConfig, MlxSettings, OptimConfig
from train.lineage import Delta, resolve_lineage
from train.schedule import (
    OPTIMIZER_FILE,
    STATE_FILE,
    WEIGHTS_FILE,
    RunLength,
    TrainState,
    checkpoint_dir,
    latest_checkpoint,
    learning_rate,
    length_batches,
    micro_batches,
    mlx_optimizer,
    prune_checkpoints,
)
from train.tokenize import IGNORE_INDEX, TokenizedExample

log = logging.getLogger("train.mlx")

# --- batches and losses ------------------------------------------------------------------------


def batch_arrays(examples: Sequence[TokenizedExample], pad_id: int) -> tuple[Any, Any]:
    """(tokens [B, T] int32, mask [B, T-1] float32): mask[b, t] weights the prediction of
    token t+1, i.e. it is 1 exactly where that token is a training label."""
    import mlx.core as mx

    width = max(len(e.input_ids) for e in examples)
    tokens = [e.input_ids + [pad_id] * (width - len(e.input_ids)) for e in examples]
    masks = []
    for e in examples:
        labels = e.labels + [IGNORE_INDEX] * (width - len(e.labels))
        masks.append([0.0 if label == IGNORE_INDEX else 1.0 for label in labels[1:]])
    return mx.array(tokens, dtype=mx.int32), mx.array(masks, dtype=mx.float32)


def token_logps(model: Any, tokens: Any) -> Any:
    """log p(token t+1 | prefix) for every position, in float32 ([B, T-1])."""
    import mlx.core as mx
    from mlx import nn

    logits = model(tokens[:, :-1]).astype(mx.float32)
    return -nn.losses.cross_entropy(logits, tokens[:, 1:], reduction="none")


def masked_nll(model: Any, tokens: Any, mask: Any) -> tuple[Any, Any]:
    """Mean NLL over masked tokens, and the token count (mlx-lm's loss, with a full mask)."""
    import mlx.core as mx
    from mlx import nn

    logits = model(tokens[:, :-1])
    ce = nn.losses.cross_entropy(logits, tokens[:, 1:], reduction="none") * mask
    ntoks = mask.sum()
    return ce.astype(mx.float32).sum() / mx.maximum(ntoks, 1), ntoks


def sequence_logps(model: Any, tokens: Any, mask: Any) -> Any:
    """Sum of log-probabilities of the masked tokens of each sequence ([B])."""
    return (token_logps(model, tokens) * mask).sum(axis=1)


def dpo_loss(
    policy_chosen: Any,
    policy_rejected: Any,
    reference_chosen: Any,
    reference_rejected: Any,
    *,
    beta: float,
    loss_type: str,
) -> tuple[Any, dict[str, Any]]:
    """DPO (`sigmoid`) or IPO (`ipo`, on length-normalised log-probs) over a batch of pairs."""
    import mlx.core as mx
    from mlx import nn

    logits = (policy_chosen - policy_rejected) - (reference_chosen - reference_rejected)
    if loss_type == "sigmoid":
        losses = -nn.log_sigmoid(beta * logits)
    elif loss_type == "ipo":
        losses = (logits - 1 / (2 * beta)) ** 2
    else:
        raise ValueError(f"loss type {loss_type!r} is not implemented on MLX (sigmoid, ipo)")
    chosen_reward = beta * (policy_chosen - reference_chosen)
    rejected_reward = beta * (policy_rejected - reference_rejected)
    metrics = {
        "reward_accuracy": (chosen_reward > rejected_reward).astype(mx.float32).mean(),
        "reward_margin": (chosen_reward - rejected_reward).mean(),
    }
    return losses.mean(), metrics


# --- adapters and trainable parameters ---------------------------------------------------------


def lora_keys(model: Any, targets: list[str] | str) -> set[str] | None:
    """Module paths (relative to a block) of the linear layers named in `targets`.

    None means mlx-lm's default: every linear layer in every block ("all-linear").
    """
    from mlx import nn

    if targets == "all-linear":
        return None
    wanted = set(targets)
    keys: set[str] = set()
    for layer in model.layers:
        for name, module in layer.named_modules():
            if name and name.split(".")[-1] in wanted and isinstance(module, nn.Linear):
                keys.add(name)
    if not keys:
        raise ValueError(f"no linear layers named {sorted(wanted)} in the model's blocks")
    return keys


def add_adapters(model: Any, lora: LoraConfig) -> None:
    from mlx_lm.tuner.utils import linear_to_lora_layers

    params: dict[str, Any] = {"rank": lora.r, "scale": lora.scale, "dropout": lora.dropout}
    keys = lora_keys(model, lora.target_modules)
    if keys is not None:
        params["keys"] = keys
    linear_to_lora_layers(model, lora.num_layers, params, use_dora=lora.dora)


def fuse_adapters(model: Any) -> int:
    """Fold LoRA/DoRA layers back into plain linear layers. Returns how many were fused."""
    from mlx.utils import tree_unflatten

    fused = [(name, module.fuse()) for name, module in model.named_modules() if _fusable(module)]
    if fused:
        model.update_modules(tree_unflatten(fused))
    return len(fused)


def _fusable(module: Any) -> bool:
    return type(module).__name__ in {"LoRALinear", "DoRALinear", "LoRAEmbedding", "DoRAEmbedding"}


def count_parameters(tree: Any) -> int:
    from mlx.utils import tree_flatten

    return sum(int(v.size) for _, v in tree_flatten(tree))


def set_trainable(
    model: Any, method: str, lora: LoraConfig | None, freeze_patterns: Sequence[str]
) -> int:
    """Freeze everything, then open up the adapters (LoRA/DoRA) or all weights not matching a
    freeze pattern (full). Returns the trainable parameter count."""
    model.freeze()
    if method == "lora":
        if lora is None:
            raise ValueError("method lora needs a lora section")
        add_adapters(model, lora)
    else:
        model.unfreeze()
        for name, module in model.named_modules():
            if name and any(pattern in name for pattern in freeze_patterns):
                module.freeze()
    trainable = count_parameters(model.trainable_parameters())
    total = count_parameters(model.parameters())
    log.info("trainable parameters: %.1fM of %.1fM", trainable / 1e6, total / 1e6)
    return trainable


def enable_grad_checkpoint(model: Any) -> None:
    """Recompute each block's activations in the backward pass (mlx-lm patches the class)."""
    from mlx_lm.tuner.trainer import grad_checkpoint

    patched: set[type] = set()
    for layer in model.layers:
        if type(layer) not in patched:
            grad_checkpoint(layer)
            patched.add(type(layer))


# --- loading -----------------------------------------------------------------------------------


def load_base(base: BaseModelConfig) -> tuple[Any, Any]:
    """The Hugging Face checkpoint as an MLX model (vision/audio towers dropped) and tokenizer."""
    from mlx_lm import load

    model, tokenizer = load(base.id, revision=base.revision)
    return model, tokenizer


def hf_tokenizer(tokenizer: Any) -> Any:
    """mlx-lm wraps the Hugging Face tokenizer; chat templating wants the original."""
    return getattr(tokenizer, "_tokenizer", tokenizer)


def apply_delta(model: Any, delta: Delta) -> None:
    import mlx.core as mx

    if delta.kind == "full":
        model.load_weights(str(delta.weights), strict=False)
    else:
        if delta.lora is None:
            raise ValueError(f"{delta.path}: adapter delta without a lora section")
        add_adapters(model, delta.lora)
        model.load_weights(str(delta.weights), strict=False)
        fuse_adapters(model)
    mx.eval(model.parameters())


def load_trained(
    path: Path, loader: Callable[[BaseModelConfig], tuple[Any, Any]] = load_base
) -> tuple[Any, Any, BaseModelConfig]:
    """Base model with every delta of `path`'s lineage applied and fused."""
    lineage = resolve_lineage(path)
    model, tokenizer = loader(lineage.base)
    for delta in lineage.deltas:
        log.info("applying %s %s delta from %s", delta.stage, delta.kind, delta.path)
        apply_delta(model, delta)
    return model, tokenizer, lineage.base


# --- the training loop -------------------------------------------------------------------------


@dataclass(frozen=True)
class FitSpec:
    output_dir: Path
    optim: OptimConfig
    settings: MlxSettings
    lengths: list[int]
    batch_size: int
    seed: int
    save_every: int
    eval_every: int
    log_every: int
    grad_checkpoint: bool
    config_digest: str = ""


# loss_fn(model, *arrays) -> (loss, ntoks, metrics); make_batch(indices) -> arrays
LossFn = Callable[..., tuple[Any, Any, dict[str, Any]]]
MakeBatch = Callable[[list[int]], tuple[Any, ...]]
EvalFn = Callable[[Any], dict[str, float]]


def save_weights(model: Any, path: Path) -> None:
    import mlx.core as mx
    from mlx.utils import tree_flatten

    mx.save_safetensors(str(path), dict(tree_flatten(model.trainable_parameters())))


def save_checkpoint(model: Any, optimizer: Any, state: TrainState, spec: FitSpec) -> Path:
    import mlx.core as mx
    from mlx.utils import tree_flatten

    path = checkpoint_dir(spec.output_dir, state.optimizer_step)
    path.mkdir(parents=True, exist_ok=True)
    save_weights(model, path / WEIGHTS_FILE)
    mx.save_safetensors(str(path / OPTIMIZER_FILE), dict(tree_flatten(optimizer.state)))
    (path / STATE_FILE).write_text(state.to_json(), encoding="utf-8")  # last: marks complete
    prune_checkpoints(spec.output_dir, spec.settings.keep_checkpoints)
    return path


def restore_checkpoint(path: Path, model: Any, optimizer: Any) -> TrainState:
    import mlx.core as mx
    from mlx.utils import tree_unflatten

    model.load_weights(str(path / WEIGHTS_FILE), strict=False)
    optimizer.init(model.trainable_parameters())
    saved = cast(dict[str, Any], mx.load(str(path / OPTIMIZER_FILE)))
    optimizer.state = tree_unflatten(list(saved.items()))
    mx.eval(model.parameters(), optimizer.state)
    return TrainState.from_json((path / STATE_FILE).read_text(encoding="utf-8"))


def make_optimizer(optim: OptimConfig) -> Any:
    from mlx import optimizers

    name = mlx_optimizer(optim.optimizer)
    cls = getattr(optimizers, name)
    if name == "AdamW":
        return cls(learning_rate=optim.learning_rate, weight_decay=optim.weight_decay)
    return cls(learning_rate=optim.learning_rate)


def set_memory_limits(settings: MlxSettings) -> None:
    import mlx.core as mx

    if settings.wired_limit_gb is not None:
        mx.set_wired_limit(int(settings.wired_limit_gb * 1e9))
        return
    try:
        from mlx_lm.utils import maybe_set_recommended_wired_limit

        maybe_set_recommended_wired_limit()
    except (ImportError, RuntimeError, ValueError):  # CPU backend: nothing to wire
        pass


class _Window:
    """Training statistics between two log lines (written to `metrics.jsonl`)."""

    def __init__(self, path: Path, total: int, per_epoch: int) -> None:
        self.path = path
        self.total = total
        self.per_epoch = per_epoch
        self.started = time.perf_counter()
        self.steps_this_run = 0
        self._reset(self.started)

    def _reset(self, now: float) -> None:
        self.loss = 0.0
        self.tokens = 0
        self.micro = 0
        self.aux: dict[str, float] = {}
        self.since = now

    def add_micro(self, loss: Any, aux: dict[str, Any]) -> None:
        self.loss += loss.item()
        self.micro += 1
        for key, value in aux.items():
            self.aux[key] = self.aux.get(key, 0.0) + float(value.item())

    def emit(self, step: int, micro: int, lr: float, grad_norm: Any, peak_gb: float) -> None:
        now = time.perf_counter()
        elapsed = now - self.started
        n = max(self.micro, 1)
        record: dict[str, Any] = {
            "step": step,
            "of": self.total,
            "epoch": round(micro / self.per_epoch, 3),
            "loss": self.loss / n,
            "lr": lr,
            "grad_norm": float(grad_norm.item()),
            "tokens_per_s": self.tokens / max(now - self.since, 1e-9),
            "peak_memory_gb": peak_gb,
            "elapsed_h": elapsed / 3600,
            "eta_h": elapsed / max(self.steps_this_run, 1) * (self.total - step) / 3600,
        }
        record.update({k: v / n for k, v in self.aux.items()})
        _append(self.path, record)
        log.info(
            "step %d/%d loss %.4f lr %.2e %.0f tok/s peak %.1f GB eta %.1f h",
            step,
            self.total,
            record["loss"],
            lr,
            record["tokens_per_s"],
            peak_gb,
            record["eta_h"],
        )
        self._reset(now)


def _start(model: Any, spec: FitSpec, optimizer: Any, resume: bool, total: int) -> TrainState:
    """Fresh state, or the newest checkpoint's (refusing one written by another config)."""
    import mlx.core as mx

    state = TrainState(0, 0, 0, spec.config_digest)
    checkpoint = latest_checkpoint(spec.output_dir) if resume else None
    if checkpoint is None:
        return state
    state = restore_checkpoint(checkpoint, model, optimizer)
    if spec.config_digest and state.config_digest != spec.config_digest:
        raise RuntimeError(
            f"{checkpoint} was written by a different config; use a new outputDir or --no-resume"
        )
    mx.random.seed(spec.seed + state.optimizer_step)
    log.info("resumed from %s (step %d of %d)", checkpoint, state.optimizer_step, total)
    return state


def _evaluate_and_save(
    model: Any,
    optimizer: Any,
    state: TrainState,
    spec: FitSpec,
    *,
    eval_fn: EvalFn | None,
    total: int,
) -> None:
    step = state.optimizer_step
    if eval_fn is not None and (step % spec.eval_every == 0 or step == total):
        model.eval()
        result = eval_fn(model)
        model.train()
        record = {"step": step, **{f"val_{k}": v for k, v in result.items()}}
        _append(spec.output_dir / "metrics.jsonl", record)
        log.info("step %d validation %s", step, result)
    if step % spec.save_every == 0 and step != total:
        log.info("checkpoint %s", save_checkpoint(model, optimizer, state, spec))


def fit(
    model: Any,
    spec: FitSpec,
    loss_fn: LossFn,
    make_batch: MakeBatch,
    eval_fn: EvalFn | None = None,
    *,
    resume: bool = True,
    max_optimizer_steps: int | None = None,
) -> TrainState:
    """Train until the configured epochs are done (or `max_optimizer_steps`, for tests).

    Checkpoints land on optimizer-step boundaries, so a resumed run continues with exactly the
    batches, learning rate and optimizer moments it would have had.
    """
    import mlx.core as mx
    from mlx import nn, optimizers
    from mlx.utils import tree_map

    set_memory_limits(spec.settings)
    mx.random.seed(spec.seed)
    optim = spec.optim
    ga = optim.gradient_accumulation_steps
    max_tokens = spec.settings.max_tokens_per_batch
    per_epoch = len(
        length_batches(
            spec.lengths, spec.batch_size, seed=spec.seed, epoch=0, max_tokens=max_tokens
        )
    )
    length = RunLength(per_epoch, ga, optim.epochs)
    total = length.optimizer_steps
    optimizer = make_optimizer(optim)
    state = _start(model, spec, optimizer, resume, total)
    if spec.grad_checkpoint:
        enable_grad_checkpoint(model)
    value_and_grad = nn.value_and_grad(model, loss_fn)
    spec.output_dir.mkdir(parents=True, exist_ok=True)
    log.info("%d batches/epoch, %d optimizer steps (accumulation %d)", per_epoch, total, ga)

    model.train()
    accum: Any = None
    step_tokens = 0
    window = _Window(spec.output_dir / "metrics.jsonl", total, per_epoch)
    for micro, indices in micro_batches(
        length,
        seed=spec.seed,
        lengths=spec.lengths,
        batch_size=spec.batch_size,
        max_tokens=max_tokens,
        start=state.micro_step,
    ):
        (loss, ntoks, aux), grads = value_and_grad(model, *make_batch(indices))
        accum = grads if accum is None else tree_map(mx.add, accum, grads)
        mx.eval(accum, loss, ntoks, aux)
        window.add_micro(loss, aux)
        step_tokens += int(ntoks.item())
        if (micro + 1) % ga:
            continue
        grads, grad_norm = optimizers.clip_grad_norm(
            tree_map(lambda g: g / ga, accum), optim.max_grad_norm
        )
        accum = None
        lr = learning_rate(state.optimizer_step, optim, total)
        optimizer.learning_rate = lr
        optimizer.update(model, grads)
        mx.eval(model.parameters(), optimizer.state)
        state = replace(
            state,
            micro_step=micro + 1,
            optimizer_step=state.optimizer_step + 1,
            trained_tokens=state.trained_tokens + step_tokens,
        )
        window.tokens += step_tokens
        window.steps_this_run += 1
        step_tokens = 0
        if (
            spec.settings.clear_cache_every
            and window.steps_this_run % spec.settings.clear_cache_every == 0
        ):
            mx.clear_cache()
        if state.optimizer_step % spec.log_every == 0 or state.optimizer_step == total:
            window.emit(state.optimizer_step, micro, lr, grad_norm, mx.get_peak_memory() / 1e9)
        _evaluate_and_save(model, optimizer, state, spec, eval_fn=eval_fn, total=total)
        if max_optimizer_steps is not None and window.steps_this_run >= max_optimizer_steps:
            save_checkpoint(model, optimizer, state, spec)
            break
    return state


def _append(path: Path, record: dict[str, Any]) -> None:
    with path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(record) + "\n")


def evaluate_batches(
    model: Any, batches: Sequence[tuple[Any, ...]], loss_fn: LossFn
) -> dict[str, float]:
    """Token-weighted mean loss (and mean aux metrics) over fixed validation batches."""
    import mlx.core as mx

    total_loss = 0.0
    total_tokens = 0
    aux_sums: dict[str, float] = {}
    for arrays in batches:
        loss, ntoks, aux = loss_fn(model, *arrays)
        mx.eval(loss, ntoks, aux)
        n = int(ntoks.item())
        total_loss += loss.item() * n
        total_tokens += n
        for key, value in aux.items():
            aux_sums[key] = aux_sums.get(key, 0.0) + float(value.item())
    out = {"loss": total_loss / max(total_tokens, 1)}
    out.update({k: v / max(len(batches), 1) for k, v in aux_sums.items()})
    return out
