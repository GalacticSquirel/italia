"""Exact float32 merge of fused models: W = W_base + sum_i c_i (W_Ai - W_Bi), cast back to each
tensor's dtype. Tensors equal across all inputs are copied as-is. Runs on CPU so a GPU job can
continue alongside.
usage: merge.py BASE_dir OUT_dir c1 A1_dir B1_dir [c2 A2_dir B2_dir ...]"""

import json
import shutil
import sys
from pathlib import Path

import mlx.core as mx

mx.set_default_device(mx.cpu)
base_dir, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
rest = sys.argv[3:]
terms = [(float(rest[i]), Path(rest[i + 1]), Path(rest[i + 2])) for i in range(0, len(rest), 3)]
out_dir.mkdir(parents=True, exist_ok=True)
for f in base_dir.iterdir():
    if f.name != "model.safetensors" and f.is_file():
        shutil.copy2(f, out_dir / f.name)
base, meta = mx.load(str(base_dir / "model.safetensors"), return_metadata=True)
loaded = {}
for _, a, b in terms:
    for d in (a, b):
        if d not in loaded:
            loaded[d] = mx.load(str(d / "model.safetensors"))
out, changed = {}, 0
for name, w in base.items():
    if w.dtype not in (mx.bfloat16, mx.float16, mx.float32):
        out[name] = w
        continue
    acc = None
    for c, a, b in terms:
        wa, wb = loaded[a][name], loaded[b][name]
        if mx.array_equal(wa, wb).item():
            continue
        term = c * (wa.astype(mx.float32) - wb.astype(mx.float32))
        acc = term if acc is None else acc + term
    if acc is None:
        out[name] = w
    else:
        out[name] = (w.astype(mx.float32) + acc).astype(w.dtype)
        changed += 1
    mx.eval(out[name])
mx.save_safetensors(str(out_dir / "model.safetensors"), out, metadata=meta)
(out_dir / "italia-export.json").write_text(json.dumps(
    {"merge_base": str(base_dir), "terms": [[c, str(a), str(b)] for c, a, b in terms]}), encoding="utf-8")
print(f"{out_dir.name}: {changed} of {len(base)} tensors changed; terms {[(c, a.name, b.name) for c, a, b in terms]}")
