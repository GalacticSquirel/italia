"""Turn an MLX training output into a Hugging Face checkpoint that llama.cpp can convert.

MLX loads Hugging Face weights through each architecture's `sanitize`, which renames tensors,
drops the vision and audio towers, and for some families changes values: Qwen3.5 stores its
RMSNorm weights as 1 + w and transposes the conv1d kernels of its linear-attention layers. So we
never hand llama.cpp MLX's own layout. Instead we copy the original checkpoint (config, tokenizer,
processor files and every tensor) and replace only the language-model tensors with the fused,
fine-tuned ones, mapped back to their original names, layouts and dtypes.

    uv run python -m export mlx-fuse --model out/mlx/dpo-gemma4-e4b/final --out out/merged/e4b
"""

from __future__ import annotations

import json
import shutil
import struct
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, cast

Shape = tuple[int, ...]
Transform = Literal["copy", "minus_one", "swap_last2"]

# Path segments that differ between Hugging Face and MLX naming of the same tensor
# (HF `model.language_model.layers.0...` vs MLX `language_model.model.layers.0...`).
_WRAPPERS = frozenset({"model", "language_model"})

# Qwen3.5 / Qwen3-Next: MLX adds 1.0 to these RMSNorm weights when it loads HF weights.
_QWEN_NORM_SUFFIXES = (
    ".input_layernorm.weight",
    ".post_attention_layernorm.weight",
    "model.norm.weight",
    ".q_norm.weight",
    ".k_norm.weight",
)

# Files copied from the original checkpoint besides the weights.
_SKIP_SUFFIXES = (".safetensors", ".bin", ".pt", ".gguf", ".msgpack", ".h5")


def normalise(name: str) -> str:
    return ".".join(part for part in name.split(".") if part not in _WRAPPERS)


def safetensors_header(path: Path) -> dict[str, Shape]:
    """Tensor shapes from a safetensors file's JSON header (reads a few KB, not the weights)."""
    with path.open("rb") as fh:
        (size,) = struct.unpack("<Q", fh.read(8))
        header = json.loads(fh.read(size))
    return {
        name: tuple(int(d) for d in info["shape"])
        for name, info in header.items()
        if name != "__metadata__"
    }


def family(model_type: str) -> str:
    return "qwen-hybrid" if model_type.startswith(("qwen3_5", "qwen3_next")) else "plain"


def inverse_transform(
    model_type: str, trained_key: str, trained: Shape, original: Shape
) -> Transform:
    """How to turn the MLX tensor back into the original layout (or raise)."""
    if family(model_type) == "qwen-hybrid":
        if "conv1d.weight" in trained_key and len(trained) == 3 and trained != original:
            swapped = (*trained[:-2], trained[-1], trained[-2])
            if swapped == original:
                return "swap_last2"
        if len(trained) == 1 and trained_key.endswith(_QWEN_NORM_SUFFIXES):
            return "minus_one"
    if trained != original:
        raise ValueError(f"{trained_key}: MLX shape {trained} does not match original {original}")
    return "copy"


@dataclass(frozen=True)
class SpliceOp:
    original: str
    trained: str
    transform: Transform


def plan_splice(
    trained: Mapping[str, Shape], original: Mapping[str, Shape], model_type: str
) -> list[SpliceOp]:
    """Pair every trained tensor with exactly one original tensor."""
    by_norm: dict[str, list[str]] = {}
    for name in original:
        by_norm.setdefault(normalise(name), []).append(name)
    ops: list[SpliceOp] = []
    unmatched: list[str] = []
    for key, shape in sorted(trained.items()):
        candidates = by_norm.get(normalise(key), [])
        if not candidates:
            unmatched.append(key)
            continue
        if len(candidates) > 1:
            raise ValueError(f"{key} matches several original tensors: {candidates}")
        target = candidates[0]
        ops.append(
            SpliceOp(target, key, inverse_transform(model_type, key, shape, original[target]))
        )
    if unmatched:
        raise ValueError(
            f"{len(unmatched)} trained tensors have no original counterpart, e.g. {unmatched[:5]}"
        )
    return ops


def apply_transform(array: Any, transform: Transform) -> Any:
    """Works on MLX and NumPy arrays alike."""
    if transform == "minus_one":
        return array - 1.0
    if transform == "swap_last2":
        return array.swapaxes(-1, -2)
    return array


@dataclass(frozen=True)
class SpliceReport:
    replaced: int
    kept: int
    transformed: int
    out_dir: Path


def read_model_type(checkpoint: Path) -> str:
    config = json.loads((checkpoint / "config.json").read_text(encoding="utf-8"))
    return str(config.get("model_type", ""))


def splice_checkpoint(fused: Mapping[str, Any], original_dir: Path, out_dir: Path) -> SpliceReport:
    """Write `out_dir`: the original checkpoint with the fused language-model tensors swapped in."""
    import mlx.core as mx

    shards = sorted(original_dir.glob("*.safetensors"))
    if not shards:
        raise FileNotFoundError(f"no safetensors shards in {original_dir}")
    original: dict[str, Shape] = {}
    for shard in shards:
        original.update(safetensors_header(shard))
    trained = {key: tuple(int(d) for d in value.shape) for key, value in fused.items()}
    ops = {op.original: op for op in plan_splice(trained, original, read_model_type(original_dir))}

    out_dir.mkdir(parents=True, exist_ok=True)
    for path in original_dir.iterdir():
        if path.is_file() and not path.name.endswith(_SKIP_SUFFIXES):
            shutil.copy2(path.resolve(), out_dir / path.name)
    replaced = transformed = 0
    for shard in shards:
        tensors = cast(dict[str, Any], mx.load(str(shard)))
        for name, current in tensors.items():
            op = ops.get(name)
            if op is None:
                continue
            new = apply_transform(fused[op.trained], op.transform).astype(current.dtype)
            tensors[name] = new
            replaced += 1
            transformed += op.transform != "copy"
        mx.save_safetensors(str(out_dir / shard.name), tensors, metadata={"format": "pt"})
        del tensors
    return SpliceReport(replaced, len(original) - replaced, transformed, out_dir)


SNAPSHOT_PATTERNS = ["*.json", "*.safetensors", "*.model", "*.txt", "*.jinja", "*.tiktoken"]


def original_checkpoint(model_id: str, revision: str | None) -> Path:
    """The base model's Hugging Face snapshot (downloaded once, then read from the cache)."""
    local = Path(model_id)
    if local.is_dir():
        return local
    from huggingface_hub import snapshot_download

    return Path(snapshot_download(model_id, revision=revision, allow_patterns=SNAPSHOT_PATTERNS))


def export_mlx(model_dir: Path, out_dir: Path, *, original_dir: Path | None = None) -> SpliceReport:
    """Fuse an MLX training output (with its lineage) and write a Hugging Face checkpoint."""
    from mlx.utils import tree_flatten

    from train.mlx_core import load_trained

    model, _tokenizer, base = load_trained(model_dir)
    fused = dict(tree_flatten(model.parameters()))
    source = original_dir or original_checkpoint(base.id, base.revision)
    report = splice_checkpoint(fused, source, out_dir)
    (out_dir / "italia-export.json").write_text(
        json.dumps(
            {"source": str(model_dir.resolve()), "base": base.id, "revision": base.revision},
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return report
