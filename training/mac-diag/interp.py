"""Round 9b: exact interpolation of two fused models, W = W8 + k (W9 - W8), computed in float32
and cast back to each tensor's dtype. Tensors identical in both are copied as-is.
usage: interp.py out/merged/round8-sft out/merged/round9-dpo K out/merged/round9-kXX"""

import json
import shutil
import sys
from pathlib import Path

import mlx.core as mx

a_dir, b_dir, k, out_dir = Path(sys.argv[1]), Path(sys.argv[2]), float(sys.argv[3]), Path(sys.argv[4])
out_dir.mkdir(parents=True, exist_ok=True)
for f in a_dir.iterdir():
    if f.name != "model.safetensors" and f.is_file():
        shutil.copy2(f, out_dir / f.name)
a, meta = mx.load(str(a_dir / "model.safetensors"), return_metadata=True)
b = mx.load(str(b_dir / "model.safetensors"))
assert a.keys() == b.keys()
out, changed = {}, 0
for name, wa in a.items():
    wb = b[name]
    if wa.dtype in (mx.bfloat16, mx.float16, mx.float32) and not mx.array_equal(wa, wb).item():
        w = wa.astype(mx.float32) + k * (wb.astype(mx.float32) - wa.astype(mx.float32))
        out[name] = w.astype(wa.dtype)
        changed += 1
    else:
        out[name] = wa
    mx.eval(out[name])
mx.save_safetensors(str(out_dir / "model.safetensors"), out, metadata=meta)
(out_dir / "italia-export.json").write_text(json.dumps(
    {"interpolated": [str(a_dir), str(b_dir)], "k": k}), encoding="utf-8")
print(f"k={k}: {changed} of {len(a)} tensors interpolated -> {out_dir}")
