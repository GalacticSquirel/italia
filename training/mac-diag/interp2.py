"""Round 9m: exact two-delta merge of fused models, W = W8 + a (W9 - W8) + b (W9c - W8), in float32,
cast back to each tensor's dtype. Tensors equal across all three are copied as-is.
usage: interp2.py W8_dir W9_dir W9c_dir ALPHA BETA out_dir"""

import json
import shutil
import sys
from pathlib import Path

import mlx.core as mx

mx.set_default_device(mx.cpu)  # GPU stays free for a concurrent judge

d8, d9, d9c = (Path(p) for p in sys.argv[1:4])
alpha, beta, out_dir = float(sys.argv[4]), float(sys.argv[5]), Path(sys.argv[6])
out_dir.mkdir(parents=True, exist_ok=True)
for f in d8.iterdir():
    if f.name != "model.safetensors" and f.is_file():
        shutil.copy2(f, out_dir / f.name)
w8, meta = mx.load(str(d8 / "model.safetensors"), return_metadata=True)
w9 = mx.load(str(d9 / "model.safetensors"))
w9c = mx.load(str(d9c / "model.safetensors"))
assert w8.keys() == w9.keys() == w9c.keys()
out, changed = {}, 0
for name, a in w8.items():
    b, c = w9[name], w9c[name]
    if a.dtype in (mx.bfloat16, mx.float16, mx.float32) and not (
        mx.array_equal(a, b).item() and mx.array_equal(a, c).item()
    ):
        a32 = a.astype(mx.float32)
        w = a32 + alpha * (b.astype(mx.float32) - a32) + beta * (c.astype(mx.float32) - a32)
        out[name] = w.astype(a.dtype)
        changed += 1
    else:
        out[name] = a
    mx.eval(out[name])
mx.save_safetensors(str(out_dir / "model.safetensors"), out, metadata=meta)
(out_dir / "italia-export.json").write_text(json.dumps(
    {"merge": [str(d8), str(d9), str(d9c)], "alpha": alpha, "beta": beta}), encoding="utf-8")
print(f"alpha={alpha} beta={beta}: {changed} of {len(w8)} tensors merged -> {out_dir}")
