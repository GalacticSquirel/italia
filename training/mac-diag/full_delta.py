"""Wrap a merged (fused) model as an MLX training output so train.dpo can start from it: a "full"
delta holding only the tensors that differ from the base, renamed to MLX parameter names via the
architecture's own sanitize, plus a lineage record (stage sft, kind full, no parent). Then check
that load_trained reproduces the merged weights.
usage (from training/): full_delta.py out/merged/round9m-b10 out/mlx/round9m-b10/final"""

import json
import sys
from pathlib import Path

import mlx.core as mx
from mlx.utils import tree_flatten

from train.config import load_dpo_config
from train.mlx_core import load_base, load_trained

merged_dir, out = Path(sys.argv[1]), Path(sys.argv[2])
cfg = load_dpo_config(Path("train/configs/mlx/dpo-gemma4-e4b.yaml"))
base_cfg = cfg.base_model
model, _ = load_base(base_cfg)
params = dict(tree_flatten(model.parameters()))
merged = mx.load(str(merged_dir / "model.safetensors"))
renamed = model.sanitize(dict(merged))  # HF names -> MLX names, towers dropped
delta = {}
for name, w in renamed.items():
    if name in params and not mx.array_equal(params[name], w).item():
        delta[name] = w
missing = [k for k in renamed if k not in params and "tower" not in k and "embed_" not in k]
out.mkdir(parents=True, exist_ok=True)
mx.save_safetensors(str(out / "weights.safetensors"), delta)
record = {
    "format": 1, "backend": "mlx", "stage": "sft", "kind": "full",
    "baseModel": base_cfg.model_dump(mode="json", by_alias=True),
    "lora": None, "parent": None,
    "config": {"source": str(merged_dir.resolve()), "note": "merged model wrapped as a full delta"},
}
(out / "italia-train.json").write_text(json.dumps(record, indent=2), encoding="utf-8")
print(f"{len(delta)} tensors differ from base; {len(missing)} sanitized names not in the model")
del model, params
check, _, _ = load_trained(out)
cp = dict(tree_flatten(check.parameters()))
bad = [k for k, w in delta.items() if not mx.array_equal(cp[k], w).item()]
print(f"round-trip check: {len(delta) - len(bad)}/{len(delta)} tensors match")
