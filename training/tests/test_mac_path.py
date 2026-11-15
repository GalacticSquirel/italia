"""The Apple Silicon path without MLX: schedules, checkpoints, lineage, memory plans, overrides,
completion masks and the Hugging Face re-layout plan."""

from __future__ import annotations

import json
import struct
from pathlib import Path
from typing import Any, Literal

import pytest

from export.splice import (
    apply_transform,
    inverse_transform,
    normalise,
    plan_splice,
    safetensors_header,
)
from tests.test_train import MESSAGES, ToyTokenizer, decode
from train.config import (
    BaseModelConfig,
    LoraConfig,
    OptimConfig,
    SftConfig,
    apply_overrides,
    load_dpo_config,
    load_sft_config,
)
from train.lineage import resolve_lineage, write_lineage
from train.memory import MODELS, estimate, recommend, table
from train.schedule import (
    STATE_FILE,
    RunLength,
    TrainState,
    checkpoint_dir,
    config_digest,
    latest_checkpoint,
    learning_rate,
    length_batches,
    list_checkpoints,
    micro_batches,
    mlx_optimizer,
    prune_checkpoints,
    warmup_steps,
)
from train.tokenize import TemplateMismatchError, tokenize_completion

ROOT = Path(__file__).resolve().parents[1]
MLX_CONFIGS = ROOT / "train" / "configs" / "mlx"

# --- schedule ----------------------------------------------------------------------------------


def test_length_batches_group_and_shuffle() -> None:
    lengths = [5, 100, 7, 90, 6, 95, 8, 99]
    batches = length_batches(lengths, 2, seed=1, epoch=0)
    assert sorted(i for b in batches for i in b) == list(range(8))
    for batch in batches:
        widths = [lengths[i] for i in batch]
        assert max(widths) - min(widths) <= 10  # similar lengths share a batch
    again = length_batches(lengths, 2, seed=1, epoch=0)
    other_epoch = length_batches(lengths, 2, seed=1, epoch=1)
    assert batches == again
    assert sorted(map(sorted, batches)) == sorted(map(sorted, other_epoch))
    capped = length_batches([100, 100, 100, 10, 10, 10], 3, seed=0, epoch=0, max_tokens=250)
    assert all(len(b) * max([100, 100, 100, 10, 10, 10][i] for i in b) <= 250 for b in capped)


def test_run_length_and_micro_batches_resume() -> None:
    length = RunLength(batches_per_epoch=5, grad_accum=2, epochs=1.5)
    assert length.micro_steps == 8 and length.optimizer_steps == 4
    lengths = list(range(10, 20))
    full = list(micro_batches(length, seed=3, lengths=lengths, batch_size=2))
    tail = list(micro_batches(length, seed=3, lengths=lengths, batch_size=2, start=6))
    assert [s for s, _ in full] == list(range(8))
    assert full[6:] == tail
    assert full[5][1] != full[0][1] or full[5:] != full[:3]  # epoch 1 reshuffles


def test_learning_rate_schedules() -> None:
    optim = OptimConfig(learning_rate=1.0, warmup_ratio=0.1)
    assert warmup_steps(optim, 100) == 10
    assert learning_rate(0, optim, 100) == pytest.approx(0.1)
    assert learning_rate(9, optim, 100) == pytest.approx(1.0)
    assert learning_rate(10, optim, 100) == pytest.approx(1.0)
    assert learning_rate(55, optim, 100) == pytest.approx(0.5)
    assert learning_rate(99, optim, 100) < 0.01
    linear = optim.model_copy(update={"lr_scheduler": "linear"})
    assert learning_rate(55, linear, 100) == pytest.approx(0.5)
    flat = optim.model_copy(update={"lr_scheduler": "constant_with_warmup"})
    assert learning_rate(90, flat, 100) == 1.0
    assert mlx_optimizer("adamw_torch_fused") == "AdamW"
    assert mlx_optimizer("adamw_8bit") == "AdamW"
    assert mlx_optimizer("adafactor") == "Adafactor"
    with pytest.raises(ValueError, match="no MLX optimizer"):
        mlx_optimizer("lion")


def test_checkpoint_listing_and_pruning(tmp_path: Path) -> None:
    for step in (10, 20, 30):
        path = checkpoint_dir(tmp_path, step)
        path.mkdir(parents=True)
        (path / STATE_FILE).write_text(TrainState(step * 2, step, 5, "d").to_json())
    checkpoint_dir(tmp_path, 40).mkdir()  # incomplete: no state file
    assert [s for s, _ in list_checkpoints(tmp_path)] == [10, 20, 30]
    latest = latest_checkpoint(tmp_path)
    assert latest is not None and latest.name == "step-0000030"
    state = TrainState.from_json((latest / STATE_FILE).read_text())
    assert state.micro_step == 60 and state.config_digest == "d"
    removed = prune_checkpoints(tmp_path, keep=2)
    assert [p.name for p in removed] == ["step-0000010"]
    assert latest_checkpoint(tmp_path / "missing") is None
    assert config_digest({"a": 1}) == config_digest({"a": 1}) != config_digest({"a": 2})


# --- lineage -----------------------------------------------------------------------------------


def _delta(path: Path, parent: Path | None, base: str = "org/base", method: str = "lora") -> Path:
    path.mkdir(parents=True)
    (path / "weights.safetensors").write_bytes(b"")
    lora = LoraConfig(r=8, alpha=16, dora=True) if method == "lora" else None
    stage: Literal["sft", "dpo"] = "sft" if parent is None else "dpo"
    write_lineage(
        path,
        stage=stage,
        base=BaseModelConfig(id=base, revision="abc"),
        method=method,
        lora=lora,
        parent=parent,
        config={},
    )
    return path


def test_lineage_walks_back_to_the_base(tmp_path: Path) -> None:
    sft = _delta(tmp_path / "sft", None)
    dpo = _delta(tmp_path / "dpo", sft, method="full")
    lineage = resolve_lineage(dpo)
    assert lineage.base.id == "org/base" and lineage.base.revision == "abc"
    assert [d.stage for d in lineage.deltas] == ["sft", "dpo"]
    assert [d.kind for d in lineage.deltas] == ["dora", "full"]
    assert lineage.deltas[0].lora is not None and lineage.deltas[0].lora.scale == 2.0
    other = _delta(tmp_path / "other", sft, base="org/else")
    with pytest.raises(ValueError, match="trained on"):
        resolve_lineage(other)
    with pytest.raises(FileNotFoundError):
        resolve_lineage(tmp_path / "nothing")
    (sft / "weights.safetensors").unlink()
    with pytest.raises(FileNotFoundError, match="missing"):
        resolve_lineage(dpo)


# --- memory plans ------------------------------------------------------------------------------


def test_memory_estimates_are_ordered_and_tiered() -> None:
    e4b = MODELS["gemma4-e4b"]
    lora = estimate(e4b, "lora", batch=1).total_gb
    full = estimate(e4b, "full", batch=1).total_gb
    assert 20 < lora < full < 80
    assert estimate(e4b, "lora", batch=1, dpo=True).total_gb > lora
    assert estimate(e4b, "lora", batch=1, grad_checkpoint=False).total_gb > lora
    small = recommend(e4b, "full", 64)
    assert small.batch == 0  # E4B full fine-tuning does not fit 64 GB
    big = recommend(e4b, "full", 512)
    assert big.batch == 8 and big.grad_accum == 2
    assert recommend(e4b, "lora", 64).batch >= 1
    text = table()
    assert "| gemma4-e4b lora |" in text and "512 GB" in text


# --- config overrides and MLX configs ----------------------------------------------------------


def test_overrides_and_mlx_configs() -> None:
    raw: dict[str, Any] = {"optim": {"learningRate": 1}}
    apply_overrides(raw, ["optim.perDeviceBatchSize=4", "lora.dora=true", "name=x"])
    assert raw == {
        "optim": {"learningRate": 1, "perDeviceBatchSize": 4},
        "lora": {"dora": True},
        "name": "x",
    }
    with pytest.raises(ValueError, match="key=value"):
        apply_overrides({}, ["nothing"])
    with pytest.raises(ValueError, match="not a section"):
        apply_overrides({"name": "x"}, ["name.sub=1"])

    sft = [load_sft_config(p) for p in sorted(MLX_CONFIGS.glob("sft-*.yaml"))]
    bake = [load_sft_config(p) for p in sorted(MLX_CONFIGS.glob("bakeoff-*.yaml"))]
    dpo = [load_dpo_config(p) for p in sorted(MLX_CONFIGS.glob("dpo-*.yaml"))]
    assert len(sft) == 4 and len(bake) == 2 and len(dpo) == 2
    assert all(c.backend == "mlx" for c in [*sft, *bake])
    assert all(c.backend == "mlx" for c in dpo)
    assert {c.method for c in sft} == {"full", "lora"}
    full = [c for c in sft if c.method == "full"]
    assert all("embed_tokens" in c.base_model.freeze_patterns for c in full)
    qwen = next(c for c in bake if "qwen" in c.name)
    assert qwen.base_model.chat_template_kwargs == {"enable_thinking": False}
    assert all(c.max_train_examples == 5000 for c in bake)
    assert all("mlx" in str(c.output_dir) for c in sft)
    assert all("mlx" in str(c.output_dir) for c in dpo)
    tuned = load_sft_config(
        MLX_CONFIGS / "sft-gemma4-e4b-lora.yaml",
        ["optim.perDeviceBatchSize=4", "optim.gradientAccumulationSteps=4", "lora.dora=true"],
    )
    assert tuned.optim.per_device_batch_size == 4 and tuned.lora is not None and tuned.lora.dora
    # Existing NVIDIA DPO configs keep the TRL backend.
    assert load_dpo_config(ROOT / "train" / "configs" / "dpo-gemma4-e4b.yaml").backend == "trl"


def test_mlx_config_validation() -> None:
    base = {
        "name": "x",
        "baseModel": {"id": "m"},
        "trainFile": "a",
        "outputDir": "o",
        "optim": {"learningRate": 1e-5},
    }
    with pytest.raises(ValueError, match="bf16 base"):
        SftConfig.model_validate({**base, "backend": "mlx", "method": "full", "loadIn4Bit": True})
    with pytest.raises(ValueError, match="DoRA"):
        SftConfig.model_validate(
            {**base, "backend": "unsloth", "method": "lora", "lora": {"dora": True}}
        )


# --- completion-only tokenisation (DPO) --------------------------------------------------------


def test_tokenize_completion_masks_everything_but_the_answer() -> None:
    answer = {"role": "assistant", "content": "A3"}
    ex = tokenize_completion(ToyTokenizer(), MESSAGES[:4], answer, max_length=500)
    assert ex is not None
    assert decode(ex.labels) == "A3<end>"  # earlier assistant turn A1 is context only
    assert tokenize_completion(ToyTokenizer(), MESSAGES[:4], answer, max_length=20) is None
    with pytest.raises(TemplateMismatchError):
        tokenize_completion(ToyTokenizer(unstable=True), MESSAGES[:4], answer, max_length=500)


# --- MLX -> Hugging Face re-layout plan --------------------------------------------------------


def test_names_normalise_across_layouts() -> None:
    hf = "model.language_model.layers.3.self_attn.q_proj.weight"
    mlx = "language_model.model.layers.3.self_attn.q_proj.weight"
    assert normalise(hf) == normalise(mlx) == "layers.3.self_attn.q_proj.weight"
    assert normalise("model.vision_tower.layers.0.w") == "vision_tower.layers.0.w"


def test_inverse_transforms() -> None:
    assert inverse_transform("gemma4", "a.weight", (4, 2), (4, 2)) == "copy"
    with pytest.raises(ValueError, match="does not match"):
        inverse_transform("gemma4", "a.weight", (4, 2), (2, 4))
    qwen = "qwen3_5"
    conv = "language_model.model.layers.0.linear_attn.conv1d.weight"
    assert inverse_transform(qwen, conv, (8, 4, 1), (8, 1, 4)) == "swap_last2"
    norm = "language_model.model.layers.0.input_layernorm.weight"
    assert inverse_transform(qwen, norm, (16,), (16,)) == "minus_one"
    assert inverse_transform(qwen, "language_model.model.norm.weight", (16,), (16,)) == "minus_one"
    other_norm = "language_model.model.layers.0.linear_attn.norm.weight"
    assert inverse_transform(qwen, other_norm, (16,), (16,)) == "copy"
    np = pytest.importorskip("numpy")
    assert apply_transform(np.ones(3), "minus_one").tolist() == [0.0, 0.0, 0.0]
    assert apply_transform(np.zeros((2, 3, 1)), "swap_last2").shape == (2, 1, 3)


def test_plan_splice_pairs_every_trained_tensor() -> None:
    original = {
        "model.language_model.embed_tokens.weight": (10, 4),
        "model.language_model.layers.0.mlp.up_proj.weight": (8, 4),
        "model.language_model.layers.1.self_attn.k_proj.weight": (2, 4),  # dropped by MLX
        "model.vision_tower.encoder.weight": (3, 3),
    }
    trained = {
        "language_model.model.embed_tokens.weight": (10, 4),
        "language_model.model.layers.0.mlp.up_proj.weight": (8, 4),
    }
    ops = plan_splice(trained, original, "gemma4")
    assert {o.original for o in ops} == {
        "model.language_model.embed_tokens.weight",
        "model.language_model.layers.0.mlp.up_proj.weight",
    }
    assert all(o.transform == "copy" for o in ops)
    with pytest.raises(ValueError, match="no original counterpart"):
        plan_splice({**trained, "language_model.extra.weight": (1,)}, original, "gemma4")
    clash = {**original, "language_model.model.embed_tokens.weight": (10, 4)}
    with pytest.raises(ValueError, match="several"):
        plan_splice(trained, clash, "gemma4")


def test_safetensors_header(tmp_path: Path) -> None:
    header = {
        "__metadata__": {"format": "pt"},
        "a": {"dtype": "BF16", "shape": [2, 3], "data_offsets": [0, 12]},
    }
    raw = json.dumps(header).encode()
    path = tmp_path / "x.safetensors"
    path.write_bytes(struct.pack("<Q", len(raw)) + raw + b"\0" * 12)
    assert safetensors_header(path) == {"a": (2, 3)}
