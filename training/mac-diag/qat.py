"""Quantization-aware LoRA fine-tuning for GGUF Q4_0 (MLX).

Simulates ggml's reference Q4_0 quantizer (ggml-quants.c quantize_row_q4_0_ref) exactly:
blocks of 32 along the input dim; m = the block value with the largest |x| (sign kept);
d = m / -8 (float32), id = 1/d; q = min(15, floor(x*id + 8.5)); stored scale d16 = fp16(d);
dequantised x_hat = d16 * (q - 8). Gradients pass straight through (STE).

Applied to exactly the tensors the stock-types export stores as Q4_0: every in-block linear
(q/k/v/o, gate/up/down, per_layer_input_gate, per_layer_projection) on its effective weight
W + scale * (B A)^T, and the per-layer token embedding (embed_tokens_per_layer) row-wise on
lookup. embed_tokens (Q8_0) and per_layer_model_projection (BF16) are left as they are.

usage: python qat.py sft -c <sft config> --set ...   (same arguments as `python -m train.sft`)
       python qat.py selftest <array.npy> <out.npy>   (writes the fake-quantised array)
"""

from __future__ import annotations

import logging
import sys
from typing import Any

import mlx.core as mx
from mlx import nn

log = logging.getLogger("qat")
QK = 32


def q4_0(w: mx.array) -> mx.array:
    """ggml Q4_0 quantise + dequantise of a 2D (rows, cols) array, cols % 32 == 0, in float32."""
    shape = w.shape
    x = w.astype(mx.float32).reshape(-1, QK)
    idx = mx.argmax(mx.abs(x), axis=1, keepdims=True)
    m = mx.take_along_axis(x, idx, axis=1)
    d = m / -8.0
    inv = mx.where(d != 0, 1.0 / mx.where(d != 0, d, 1.0), 0.0)
    q = mx.minimum(15.0, mx.floor(x * inv + 8.5))
    d16 = d.astype(mx.float16).astype(mx.float32)
    return (d16 * (q - 8.0)).reshape(shape)


import numpy as _np

# make_qx_quants(n=16, nmax=32, rmse_type=1) candidate numerators: the first pass (-nmax), then
# -(nmax + 0.1f*is) for is = -9..9, is != 0, all in float32 as in the C source.
_Q6_NUM = [_np.float32(-32.0)] + [-(_np.float32(32) + _np.float32(0.1) * _np.float32(i))
                                   for i in range(-9, 10) if i != 0]


def _q6_round(v: mx.array) -> mx.array:
    return mx.round(v)  # nearest_int: round half to even (fp add-magic trick), as mx.round


def q6_k(w: mx.array) -> mx.array:
    """ggml quantize_row_q6_K_ref + dequantise, cols % 256 == 0, float32."""
    shape = w.shape
    x = w.astype(mx.float32).reshape(-1, 16)                 # sub-blocks of 16
    idx = mx.argmax(mx.abs(x), axis=1, keepdims=True)
    mxv = mx.take_along_axis(x, idx, axis=1)                 # signed max |x| (first occurrence)
    alive = mx.abs(mxv) >= 1e-15
    safe = mx.where(alive, mxv, 1.0)
    wgt = x * x
    scale = best = None
    for k, num in enumerate(_Q6_NUM):
        iscale = mx.array(num) / safe
        l = mx.clip(_q6_round(iscale * x), -32, 31)
        sumlx = mx.sum(wgt * x * l, axis=1, keepdims=True)
        suml2 = mx.sum(wgt * l * l, axis=1, keepdims=True)
        cand = mx.where(suml2 > 0, sumlx / mx.where(suml2 > 0, suml2, 1.0), 0.0)
        if k == 0:
            scale, best = cand, cand * sumlx
        else:
            take = (suml2 > 0) & (sumlx * sumlx > best * suml2)
            scale = mx.where(take, cand, scale)
            best = mx.where(take, cand * sumlx, best)
    scale = mx.where(alive, scale, 0.0).reshape(-1, 16)       # (super-blocks, 16 sub-scales)
    sidx = mx.argmax(mx.abs(scale), axis=1, keepdims=True)
    msc = mx.take_along_axis(scale, sidx, axis=1)
    salive = mx.abs(msc) >= 1e-15
    iscale = mx.array(_np.float32(-128.0)) / mx.where(salive, msc, 1.0)
    d16 = (1.0 / iscale).astype(mx.float16).astype(mx.float32)
    sc = mx.minimum(127.0, _q6_round(iscale * scale))
    dd = (d16 * sc).reshape(-1, 1)                          # per sub-block
    xs = x
    q = mx.clip(_q6_round(xs / mx.where(dd != 0, dd, 1.0)), -32, 31)
    out = mx.where((dd != 0) & mx.repeat(salive, 16, axis=1).reshape(-1, 1), dd * q, 0.0)
    return out.reshape(shape)


QUANT = {"q4_0": q4_0, "q6_k": mx.compile(q6_k)}

# Weights change only in optimizer.update, so a quantised weight is the same for every
# micro-batch (and eval) between two updates: cache the expensive Q6_K result per update.
_VERSION = [0]
_CACHE: dict[int, tuple[int, mx.array]] = {}


def _bump_on_update() -> None:
    import mlx.optimizers as optim

    if getattr(optim.Optimizer.update, "_qat_bump", False):
        return
    original = optim.Optimizer.update

    def update(self, model, gradients):
        _VERSION[0] += 1
        return original(self, model, gradients)

    update._qat_bump = True
    optim.Optimizer.update = update


def _quantised(module: Any, w: mx.array, qfn) -> mx.array:
    if qfn is q4_0:  # cheap; recompute
        return qfn(w).astype(w.dtype)
    hit = _CACHE.get(id(module))
    if hit is not None and hit[0] == _VERSION[0]:
        return hit[1]
    q = mx.stop_gradient(qfn(mx.stop_gradient(w)).astype(w.dtype))
    _CACHE[id(module)] = (_VERSION[0], q)
    return q


def ste(w: mx.array, qfn=q4_0, module: Any = None) -> mx.array:
    q = _quantised(module, w, qfn) if module is not None else qfn(w).astype(w.dtype)
    return w + mx.stop_gradient(q - w)


def _make_lora_call(qfn):
    def _lora_call(self, x: mx.array) -> mx.array:
        """LoRALinear forward with Q(W + scale * B^T A^T) and STE."""
        w = self.linear.weight
        delta = (self.scale * self.lora_b.T) @ self.lora_a.T
        y = x @ ste(w + delta.astype(w.dtype), qfn, self).T
        if "bias" in self.linear:
            y = y + self.linear.bias
        return y
    return _lora_call


def _make_linear_call(qfn):
    def _linear_call(self, x: mx.array) -> mx.array:
        """Frozen Linear destined for a quantised type."""
        w = mx.stop_gradient(_quantised(self, self.weight, qfn))
        y = x @ w.T
        if "bias" in self:
            y = y + self.bias
        return y
    return _linear_call


_lora_call = _make_lora_call(q4_0)
_linear_call = _make_linear_call(q4_0)


def _embedding_call(self, x: mx.array) -> mx.array:
    """Frozen embedding table destined for Q4_0: quantise the looked-up rows."""
    rows = self.weight[x]
    flat = rows.reshape(-1, rows.shape[-1])
    return mx.stop_gradient(q4_0(flat).reshape(rows.shape).astype(rows.dtype))


_SUBCLASSES: dict[tuple, type] = {}


def _retype(module: Any, call: Any, key: str = "q4_0") -> None:
    """Swap the instance's class for a same-named subclass whose forward is fake-quantised, so
    parameter paths, saved adapter names and fuse_adapters (which matches on type name) are
    unchanged."""
    base = type(module)
    if (base, key) not in _SUBCLASSES:
        _SUBCLASSES[(base, key)] = type(base.__name__, (base,), {"__call__": call, "_qat": True})
    module.__class__ = _SUBCLASSES[(base, key)]


# QAT_Q6K=1: the mx2 export types (ffn_down and attn_output Q6_K, the rest Q4_0).
Q6K_SUFFIXES = (".mlp.down_proj", ".self_attn.o_proj")


def _qtype(name: str) -> str:
    import os

    if os.environ.get("QAT_Q6K") == "1" and name.endswith(Q6K_SUFFIXES):
        return "q6_k"
    return "q4_0"


def apply_qat(model: Any) -> dict[str, int]:
    counts = {"lora": 0, "linear": 0, "embedding": 0, "q6_k": 0}
    _bump_on_update()
    lora_children = set()
    mods = list(model.named_modules())
    for name, module in mods:
        if type(module).__name__ == "LoRALinear":
            lora_children.add(f"{name}.linear")
    for name, module in mods:
        if getattr(module, "_qat", False):
            continue
        kind = type(module).__name__
        in_block = ".layers." in f".{name}" and "vision" not in name and "audio" not in name
        if in_block and kind == "LoRALinear":
            qt = _qtype(name)
            _retype(module, _make_lora_call(QUANT[qt]), qt)
            counts["lora"] += 1
            counts["q6_k"] += qt == "q6_k"
        elif in_block and kind == "Linear" and name not in lora_children:
            qt = _qtype(name)
            _retype(module, _make_linear_call(QUANT[qt]), qt)
            counts["linear"] += 1
            counts["q6_k"] += qt == "q6_k"
        elif name.endswith("embed_tokens_per_layer") and kind == "Embedding":
            _retype(module, _embedding_call)
            counts["embedding"] += 1
    log.info("QAT Q4_0 fake-quant on %s", counts)
    return counts


def mask_to_last_turn(ex: Any) -> Any:
    """Keep only the last contiguous run of trainable labels (the final assistant turn); earlier
    assistant turns are gold context in the distillation items."""
    from train.tokenize import IGNORE_INDEX, TokenizedExample

    if ex is None:
        return None
    labels = list(ex.labels)
    end = max((i for i, v in enumerate(labels) if v != IGNORE_INDEX), default=-1)
    start = end
    while start > 0 and labels[start - 1] != IGNORE_INDEX:
        start -= 1
    masked = [v if end >= 0 and start <= i <= end else IGNORE_INDEX for i, v in enumerate(labels)]
    return TokenizedExample(input_ids=ex.input_ids, labels=masked)


def main() -> None:
    if sys.argv[1] == "selftest":
        import numpy as np

        a = mx.array(np.load(sys.argv[2]))
        qfn = QUANT[sys.argv[4]] if len(sys.argv) > 4 else q4_0
        np.save(sys.argv[3], np.array(qfn(a)))
        return
    if sys.argv[1] == "dpo":
        # QAT-DPO: fake-quant from the moment the policy is loaded, so the cached reference
        # log-probabilities are those of the quantised policy (mx2 behaviour), then again on the
        # LoRA-wrapped modules. Lineage parent is policyModel (train.dpo records it).
        import runpy

        import train.mlx_dpo as mlx_dpo

        original_load = mlx_dpo.load_trained
        original_trainable = mlx_dpo.set_trainable

        def load_qat(path):
            model, tokenizer, base = original_load(path)
            apply_qat(model)
            return model, tokenizer, base

        def set_trainable_qat(model, method, lora, freeze_patterns):
            n = original_trainable(model, method, lora, freeze_patterns)
            _CACHE.clear()  # reference-stage entries of the now-wrapped linears
            apply_qat(model)
            return n

        mlx_dpo.load_trained = load_qat
        mlx_dpo.set_trainable = set_trainable_qat
        sys.argv = ["train.dpo", *sys.argv[2:]]
        runpy.run_module("train.dpo", run_name="__main__")
        return
    assert sys.argv[1] == "sft"
    import os
    import runpy
    from pathlib import Path

    import train.mlx_sft as mlx_sft
    from train.mlx_core import load_trained

    # Start from an existing MLX output (QAT_PARENT, e.g. out/mlx/round12m/final) instead of the
    # bare base, and record it as the parent so mlx-fuse rebuilds base -> parent -> QAT LoRA.
    parent = Path(os.environ["QAT_PARENT"]).resolve()
    original_trainable = mlx_sft.set_trainable
    original_lineage = mlx_sft.write_lineage

    def load_parent(base):
        model, tokenizer, lineage_base = load_trained(parent)
        if (lineage_base.id, lineage_base.revision) != (base.id, base.revision):
            raise ValueError(f"{parent} was trained from {lineage_base.id}, not {base.id}")
        return model, tokenizer

    def set_trainable_qat(model, method, lora, freeze_patterns):
        n = original_trainable(model, method, lora, freeze_patterns)
        apply_qat(model)
        return n

    def write_lineage_with_parent(final, **kw):
        kw["parent"] = parent
        return original_lineage(final, **kw)

    # Pure self-distillation: train only on the final assistant turn (the teacher's output).
    import train.sft as sft

    original_tok = sft.tokenize_conversation

    def last_turn_only(*args, **kwargs):
        return mask_to_last_turn(original_tok(*args, **kwargs))

    sft.tokenize_conversation = last_turn_only
    mlx_sft.load_base = load_parent
    mlx_sft.set_trainable = set_trainable_qat
    mlx_sft.write_lineage = write_lineage_with_parent
    sys.argv = ["train.sft", *sys.argv[2:]]
    runpy.run_module("train.sft", run_name="__main__")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
