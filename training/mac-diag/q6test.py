"""Compare qat.q6_k / q4_0 with ggml (qref) on real Gemma weights + synthetic data."""
import glob, os, subprocess, sys, time
import numpy as np
import mlx.core as mx
sys.path.insert(0, os.path.expanduser("~/italia-diag"))
import qat

files = sorted(glob.glob(os.path.expanduser("~/hf-italia/hub/models--google--gemma-4-E4B*/snapshots/*/*.safetensors")))
w = {}
for f in files:
    d = mx.load(f)
    for k, v in d.items():
        if ("layers.30.mlp.down_proj.weight" in k or "layers.3.self_attn.o_proj.weight" in k) and "language" in k:
            w[k] = np.array(v.astype(mx.float32))
rng = np.random.default_rng(0)
w["gauss-heavy"] = (rng.standard_t(3, size=(64, 1024)) * 0.02).astype(np.float32)
z = rng.normal(size=(8, 512)).astype(np.float32); z[0, :16] = 0; z[1, :256] = 0; z[2, 5] = 0.3
w["zeros/ties"] = z
for k, a in w.items():
    a.tofile("/tmp/q_in.f32")
    for t in ("q6_k", "q4_0"):
        subprocess.run([os.path.expanduser("~/italia-diag/qref"), t, str(a.shape[0]), str(a.shape[1]), "/tmp/q_in.f32", "/tmp/q_out.f32"], check=True)
        ref = np.fromfile("/tmp/q_out.f32", dtype=np.float32).reshape(a.shape)
        t0 = time.time(); sim = np.array(qat.QUANT[t](mx.array(a))); dt = time.time() - t0
        diff = sim != ref
        print(f"{k} {a.shape} {t}: mismatched {diff.sum()} of {a.size} "
              f"({100*diff.mean():.4f}%), max |diff| {np.abs(sim-ref).max():.3e}, "
              f"rel err vs float {np.linalg.norm(ref-a)/np.linalg.norm(a):.4f}, {dt:.2f}s")
