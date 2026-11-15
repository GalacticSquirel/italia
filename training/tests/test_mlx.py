"""MLX training code on a tiny randomly initialised model (MLX's CPU backend on Linux)."""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import pytest

from train.config import BaseModelConfig, LoraConfig, MlxSettings, OptimConfig
from train.lineage import write_lineage
from train.tokenize import IGNORE_INDEX, TokenizedExample

mx = pytest.importorskip("mlx.core")
nn = pytest.importorskip("mlx.nn")
pytest.importorskip("mlx_lm")

from mlx.utils import tree_flatten  # noqa: E402
from mlx_lm.models import llama  # noqa: E402

from train import mlx_core  # noqa: E402
from train.mlx_dpo import PairBatcher, reference_logps  # noqa: E402

VOCAB = 40


def tiny_model(seed: int = 0) -> Any:
    mx.random.seed(seed)
    args = llama.ModelArgs(
        model_type="llama",
        hidden_size=16,
        num_hidden_layers=2,
        intermediate_size=32,
        num_attention_heads=2,
        rms_norm_eps=1e-5,
        vocab_size=VOCAB,
        num_key_value_heads=1,
    )
    model = llama.Model(args)
    mx.eval(model.parameters())
    return model


def example(ids: list[int], trained_from: int) -> TokenizedExample:
    labels = [IGNORE_INDEX] * trained_from + ids[trained_from:]
    return TokenizedExample(input_ids=ids, labels=labels)


def params(model: Any) -> dict[str, Any]:
    return dict(tree_flatten(model.parameters()))


def test_mask_marks_label_positions() -> None:
    tokens, mask = mlx_core.batch_arrays([example([1, 2, 3, 4], 2), example([5, 6], 1)], 0)
    assert tokens.tolist() == [[1, 2, 3, 4], [5, 6, 0, 0]]
    assert mask.tolist() == [[0.0, 1.0, 1.0], [1.0, 0.0, 0.0]]


def test_masked_nll_ignores_prompt_tokens() -> None:
    model = tiny_model()
    a = example([1, 2, 3, 4, 5], 3)
    b = example([9, 9, 9, 4, 5], 3)  # different prompt tokens; same targets
    loss_a, n_a = mlx_core.masked_nll(model, *mlx_core.batch_arrays([a], 0))
    tokens, mask = mlx_core.batch_arrays([a], 0)
    manual = -(mlx_core.token_logps(model, tokens) * mask).sum() / mask.sum()
    assert math.isclose(loss_a.item(), manual.item(), rel_tol=1e-3)
    assert n_a.item() == 2
    loss_b, _ = mlx_core.masked_nll(model, *mlx_core.batch_arrays([b], 0))
    assert loss_a.item() != loss_b.item()  # context matters, but only targets are scored
    seq = mlx_core.sequence_logps(model, tokens, mask)
    assert math.isclose(seq.item(), -loss_a.item() * 2, rel_tol=1e-3)


def test_dpo_loss_values() -> None:
    zero = mx.array([0.0, 0.0])
    loss, metrics = mlx_core.dpo_loss(zero, zero, zero, zero, beta=0.1, loss_type="sigmoid")
    assert math.isclose(loss.item(), math.log(2), rel_tol=1e-5)
    better = mx.array([1.0, 2.0])
    loss2, metrics2 = mlx_core.dpo_loss(better, zero, zero, zero, beta=0.5, loss_type="sigmoid")
    assert loss2.item() < loss.item() and metrics2["reward_accuracy"].item() == 1.0
    ipo, _ = mlx_core.dpo_loss(zero, zero, zero, zero, beta=0.5, loss_type="ipo")
    assert math.isclose(ipo.item(), 1.0)
    with pytest.raises(ValueError, match="not implemented"):
        mlx_core.dpo_loss(zero, zero, zero, zero, beta=0.1, loss_type="robust")
    assert metrics["reward_margin"].item() == 0.0


def test_lora_targets_freeze_and_fuse() -> None:
    model = tiny_model()
    tokens = mx.array([[1, 2, 3, 4]])
    before = model(tokens)
    lora = LoraConfig(r=4, alpha=8, target_modules=["q_proj", "v_proj"])
    assert mlx_core.lora_keys(model, lora.target_modules) == {
        "self_attn.q_proj",
        "self_attn.v_proj",
    }
    assert mlx_core.lora_keys(model, "all-linear") is None
    with pytest.raises(ValueError, match="no linear layers"):
        mlx_core.lora_keys(model, ["nope"])
    n = mlx_core.set_trainable(model, "lora", lora, [])
    names = [k for k, _ in tree_flatten(model.trainable_parameters())]
    assert names and all("lora_" in k for k in names)
    assert n == 2 * 2 * (4 * 16 + 4 * 16) - 2 * 4 * (16 - 8)  # q: 16->16, v: 16->8
    # Give the adapters a non-zero update, then fusing must preserve the function.
    for layer in model.layers:
        layer.self_attn.q_proj.lora_b = mx.ones((4, 16)) * 0.1
    adapted = model(tokens)
    assert not mx.allclose(adapted, before).item()
    assert mlx_core.fuse_adapters(model) == 4
    assert mx.allclose(model(tokens), adapted, atol=1e-4).item()
    assert not any("lora_" in k for k in params(model))


def test_full_trainable_respects_freeze_patterns() -> None:
    model = tiny_model()
    mlx_core.set_trainable(model, "full", None, ["embed_tokens"])
    names = [k for k, _ in tree_flatten(model.trainable_parameters())]
    assert names and not any("embed_tokens" in k for k in names)


def sft_spec(tmp: Path, lengths: list[int], **overrides: Any) -> mlx_core.FitSpec:
    optim = OptimConfig(
        learning_rate=1e-2,
        epochs=2,
        per_device_batch_size=2,
        gradient_accumulation_steps=2,
        warmup_ratio=0.1,
        optimizer="adamw_torch_fused",
    )
    base: dict[str, Any] = {
        "output_dir": tmp,
        "optim": optim,
        "settings": MlxSettings(keep_checkpoints=2),
        "lengths": lengths,
        "batch_size": 2,
        "seed": 7,
        "save_every": 2,
        "eval_every": 3,
        "log_every": 1,
        "grad_checkpoint": False,
        "config_digest": "abc",
    }
    base.update(overrides)
    return mlx_core.FitSpec(**base)


DATA = [example([1, 2, 3, 4, 5, 6][: 3 + i % 4], 2) for i in range(12)]


def sft_parts() -> tuple[Any, Any]:
    def make_batch(indices: list[int]) -> tuple[Any, ...]:
        return mlx_core.batch_arrays([DATA[i] for i in indices], 0)

    def loss_fn(model: Any, tokens: Any, mask: Any) -> tuple[Any, Any, dict[str, Any]]:
        loss, ntoks = mlx_core.masked_nll(model, tokens, mask)
        return loss, ntoks, {}

    return make_batch, loss_fn


def test_fit_learns_logs_and_checkpoints(tmp_path: Path) -> None:
    model = tiny_model()
    mlx_core.set_trainable(model, "lora", LoraConfig(r=4, alpha=8), [])
    make_batch, loss_fn = sft_parts()
    val = [make_batch([0, 1])]
    before = mlx_core.evaluate_batches(model, val, loss_fn)["loss"]
    spec = sft_spec(tmp_path, [len(e.input_ids) for e in DATA])

    state = mlx_core.fit(
        model, spec, loss_fn, make_batch, lambda m: mlx_core.evaluate_batches(m, val, loss_fn)
    )
    assert state.optimizer_step == 6  # 6 batches/epoch x 2 epochs / accumulation 2
    after = mlx_core.evaluate_batches(model, val, loss_fn)["loss"]
    assert after < before
    lines = [json.loads(x) for x in (tmp_path / "metrics.jsonl").read_text().splitlines()]
    assert lines[0]["step"] == 1 and "peak_memory_gb" in lines[0]
    assert any("val_loss" in line for line in lines)
    kept = sorted(p.name for p in (tmp_path / "checkpoints").iterdir())
    assert kept == ["step-0000002", "step-0000004"]


def test_resume_matches_uninterrupted_run(tmp_path: Path) -> None:
    make_batch, loss_fn = sft_parts()
    lengths = [len(e.input_ids) for e in DATA]

    full = tiny_model()
    mlx_core.set_trainable(full, "full", None, [])
    mlx_core.fit(full, sft_spec(tmp_path / "a", lengths), loss_fn, make_batch)

    part = tiny_model()
    mlx_core.set_trainable(part, "full", None, [])
    spec = sft_spec(tmp_path / "b", lengths)
    first = mlx_core.fit(part, spec, loss_fn, make_batch, max_optimizer_steps=3)
    assert first.optimizer_step == 3
    resumed = tiny_model(seed=99)  # fresh process: weights come from the checkpoint
    mlx_core.set_trainable(resumed, "full", None, [])
    final = mlx_core.fit(resumed, spec, loss_fn, make_batch)
    assert final.optimizer_step == 6
    a, b = params(full), params(resumed)
    assert all(mx.allclose(a[k], b[k], atol=1e-5).item() for k in a)

    other = sft_spec(tmp_path / "b", lengths, config_digest="different")
    with pytest.raises(RuntimeError, match="different config"):
        mlx_core.fit(tiny_model(), other, loss_fn, make_batch)


def test_load_trained_applies_deltas_in_order(tmp_path: Path) -> None:
    base = BaseModelConfig(id="tiny")
    lora = LoraConfig(r=4, alpha=8)
    reference = tiny_model()
    mlx_core.set_trainable(reference, "lora", lora, [])
    for layer in reference.layers:
        layer.mlp.up_proj.lora_b = mx.ones((4, 32)) * 0.05
    sft = tmp_path / "sft"
    sft.mkdir()
    mlx_core.save_weights(reference, sft / "weights.safetensors")
    write_lineage(sft, stage="sft", base=base, method="lora", lora=lora, parent=None, config={})
    mlx_core.fuse_adapters(reference)

    # A full-weights DPO delta on top: change the final norm.
    child = tiny_model()
    mlx_core.set_trainable(child, "full", None, ["layers", "embed_tokens"])
    child.model.norm.weight = mx.ones((16,)) * 2.0
    dpo = tmp_path / "dpo"
    dpo.mkdir()
    mlx_core.save_weights(child, dpo / "weights.safetensors")
    write_lineage(dpo, stage="dpo", base=base, method="full", lora=None, parent=sft, config={})
    reference.model.norm.weight = mx.ones((16,)) * 2.0

    calls: list[str] = []

    def loader(b: BaseModelConfig) -> tuple[Any, Any]:
        calls.append(b.id)
        return tiny_model(), None

    model, _tok, got_base = mlx_core.load_trained(dpo, loader)
    assert calls == ["tiny"] and got_base.id == "tiny"
    tokens = mx.array([[1, 2, 3]])
    assert mx.allclose(model(tokens), reference(tokens), atol=1e-4).item()


def test_dpo_reference_and_training_step() -> None:
    chosen = [example([1, 2, 3, 4], 2), example([1, 2, 5, 6, 7], 2)]
    rejected = [example([1, 2, 8], 2), example([1, 2, 9, 9], 2)]
    batcher = PairBatcher(chosen, rejected, pad_id=0)
    model = tiny_model()
    ref = reference_logps(model, batcher, batch_size=1)
    assert len(ref) == 2
    tokens, mask, _ = batcher.arrays([0, 1], ref)
    logps = mlx_core.sequence_logps(model, tokens, mask)
    assert math.isclose(logps[0].item(), ref[0][0], rel_tol=1e-4)
    assert math.isclose(logps[2].item(), ref[0][1], rel_tol=1e-4)


def test_splice_restores_hf_layout(tmp_path: Path) -> None:
    from export.splice import splice_checkpoint

    original = tmp_path / "hf"
    original.mkdir()
    (original / "config.json").write_text(json.dumps({"model_type": "qwen3_5"}))
    (original / "tokenizer.json").write_text("{}")
    norm = mx.zeros((4,), dtype=mx.bfloat16)
    conv = mx.arange(24, dtype=mx.float32).reshape(2, 1, 12).astype(mx.bfloat16)
    vision = mx.ones((3,), dtype=mx.bfloat16)
    mx.save_safetensors(
        str(original / "model-00001-of-00002.safetensors"),
        {"model.language_model.layers.0.input_layernorm.weight": norm},
    )
    mx.save_safetensors(
        str(original / "model-00002-of-00002.safetensors"),
        {
            "model.language_model.layers.0.linear_attn.conv1d.weight": conv,
            "model.visual.blocks.0.weight": vision,
        },
    )
    # What MLX holds after loading and fine-tuning: +1 norms, transposed conv, new values.
    fused = {
        "language_model.model.layers.0.input_layernorm.weight": mx.full((4,), 1.5),
        "language_model.model.layers.0.linear_attn.conv1d.weight": conv.swapaxes(1, 2) * 2,
    }
    out = tmp_path / "out"
    report = splice_checkpoint(fused, original, out)
    assert (report.replaced, report.kept, report.transformed) == (2, 1, 2)
    assert (out / "tokenizer.json").exists() and (out / "config.json").exists()
    first = mx.load(str(out / "model-00001-of-00002.safetensors"))
    second = mx.load(str(out / "model-00002-of-00002.safetensors"))
    restored_norm = first["model.language_model.layers.0.input_layernorm.weight"]
    assert restored_norm.dtype == mx.bfloat16
    assert mx.allclose(restored_norm.astype(mx.float32), mx.full((4,), 0.5)).item()
    restored_conv = second["model.language_model.layers.0.linear_attn.conv1d.weight"]
    assert restored_conv.shape == (2, 1, 12)
    assert mx.allclose(restored_conv, conv * 2).item()
    assert mx.allclose(second["model.visual.blocks.0.weight"], vision).item()


def test_end_to_end_sft_dpo_export(tmp_path: Path) -> None:
    """The real entry points on a tiny local checkpoint: SFT, resume, DPO, fuse + re-layout."""
    pytest.importorskip("tokenizers")
    from mlx_lm import load

    from export.splice import export_mlx
    from tests.tiny_hf import write_tiny_checkpoint, write_tiny_data
    from train import mlx_dpo, mlx_sft
    from train.config import load_dpo_config, load_sft_config

    base = write_tiny_checkpoint(tmp_path / "base")
    write_tiny_data(tmp_path / "sft.jsonl", tmp_path / "pairs.jsonl")
    configs = Path(__file__).resolve().parents[1] / "train" / "configs" / "mlx"
    common = [f"baseModel.id={base}", "baseModel.freezePatterns=[]", "loggingSteps=1"]
    sft_config = load_sft_config(
        configs / "sft-gemma4-e4b-lora.yaml",
        [
            *common,
            f"trainFile={tmp_path / 'sft.jsonl'}",
            f"valFile={tmp_path / 'sft.jsonl'}",
            f"outputDir={tmp_path / 'sft'}",
            "optim.perDeviceBatchSize=4",
            "optim.gradientAccumulationSteps=1",
            "optim.learningRate=1e-2",
            "saveSteps=3",
            "lora.r=4",
            "lora.alpha=8",
        ],
    )
    sft_final = mlx_sft.run(sft_config)
    assert (sft_final / "italia-train.json").exists()
    assert (tmp_path / "sft" / "checkpoints" / "step-0000006").exists()
    again = mlx_sft.run(sft_config)  # resumes from the newest checkpoint (step 6 of 8)
    assert again == sft_final

    dpo_config = load_dpo_config(
        configs / "dpo-gemma4-e4b.yaml",
        [
            *common,
            f"policyModel={sft_final}",
            f"pairsFile={tmp_path / 'pairs.jsonl'}",
            "valFraction=0.2",
            f"outputDir={tmp_path / 'dpo'}",
            "optim.perDeviceBatchSize=2",
            "optim.gradientAccumulationSteps=1",
            "optim.learningRate=5e-3",
            "lora.r=4",
            "lora.alpha=8",
        ],
    )
    dpo_final = mlx_dpo.run(dpo_config)
    assert (tmp_path / "dpo" / "reference_logps.json").exists()
    lines = (tmp_path / "dpo" / "metrics.jsonl").read_text().splitlines()
    assert "reward_accuracy" in lines[0]

    report = export_mlx(dpo_final, tmp_path / "merged")
    assert report.replaced > 0 and (tmp_path / "merged" / "tokenizer.json").exists()
    fused, _, _ = mlx_core.load_trained(dpo_final)
    spliced, _ = load(str(tmp_path / "merged"))
    original, _ = load(str(base))
    tokens = mx.array([[2, 10, 20, 30]])
    assert mx.allclose(fused(tokens), spliced(tokens)).item()
    assert not mx.allclose(original(tokens), spliced(tokens)).item()
