"""numpy Q6_K ref variants: accumulation sequential plain vs FMA (f64-emulated)."""
import glob, os, subprocess, sys
import numpy as np
import mlx.core as mx
f32 = np.float32
NUM = [f32(-32.0)] + [-(f32(32) + f32(0.1) * f32(i)) for i in range(-9, 10) if i != 0]
NUMF = [f32(-32.0)] + [-f32(np.float64(f32(0.1)) * i + 32.0) for i in range(-9, 10) if i != 0]
print("numerators differ at", [i for i,(p,q) in enumerate(zip(NUM,NUMF)) if p!=q])

def acc(terms_a, terms_b, fma):
    # sum_i a_i*b_i sequentially; fma: s = fl32(a*b + s) computed exactly then rounded once
    s = np.zeros(terms_a.shape[0], f32)
    for i in range(terms_a.shape[1]):
        if fma:
            s = (terms_a[:, i].astype(np.float64) * terms_b[:, i].astype(np.float64) + s.astype(np.float64)).astype(f32)
        else:
            s = (terms_a[:, i] * terms_b[:, i] + s).astype(f32)
    return s

def q6(a, fma, nums):
    x = a.reshape(-1, 16).astype(f32)
    idx = np.argmax(np.abs(x), axis=1)
    m = x[np.arange(len(x)), idx]
    alive = np.abs(m) >= f32(1e-15); safe = np.where(alive, m, f32(1))
    w = x * x
    for k, num in enumerate(nums):
        isc = (num / safe).astype(f32)
        l = np.clip(np.round(isc[:, None].astype(np.float64) * x) if fma else np.round((isc[:, None] * x).astype(f32)), -32, 31).astype(f32)
        sumlx = acc((w * x).astype(f32), l, fma)
        suml2 = acc((w * l).astype(f32), l, fma)
        cand = np.where(suml2 > 0, sumlx / np.where(suml2 > 0, suml2, f32(1)), f32(0)).astype(f32)
        if k == 0:
            scale, best = cand, (cand * sumlx).astype(f32)
        else:
            take = (suml2 > 0) & ((sumlx * sumlx).astype(f32) > (best * suml2).astype(f32))
            scale = np.where(take, cand, scale); best = np.where(take, (cand * sumlx).astype(f32), best)
    scale = np.where(alive, scale, f32(0)).reshape(-1, 16)
    si = np.argmax(np.abs(scale), axis=1); ms = scale[np.arange(len(scale)), si]
    sal = np.abs(ms) >= f32(1e-15)
    isc = (f32(-128) / np.where(sal, ms, f32(1))).astype(f32)
    d16 = (f32(1) / isc).astype(np.float16).astype(f32)
    sc = np.minimum(f32(127), np.round(isc[:, None].astype(np.float64) * scale) if fma else np.round((isc[:, None] * scale).astype(f32)))
    dd = (d16[:, None] * sc).astype(f32).reshape(-1, 1)
    q = np.clip(np.round((x / np.where(dd != 0, dd, f32(1))).astype(f32)), -32, 31)
    return np.where(dd != 0, dd * q, f32(0)).astype(f32).reshape(a.shape)

files = sorted(glob.glob(os.path.expanduser("~/hf-italia/hub/models--google--gemma-4-E4B*/snapshots/*/*.safetensors")))
for f in files:
    d = mx.load(f)
    for k, v in d.items():
        if "language_model.layers.3.self_attn.o_proj.weight" in k:
            a = np.array(v.astype(mx.float32))
a.tofile("/tmp/q_in.f32")
subprocess.run([os.path.expanduser("~/italia-diag/qref"), "q6_k", str(a.shape[0]), str(a.shape[1]), "/tmp/q_in.f32", "/tmp/q_out.f32"], check=True)
ref = np.fromfile("/tmp/q_out.f32", dtype=f32).reshape(a.shape)
for fma in (True,):
  for nn, nums in (("num", NUM),):
    sim = q6(a, fma, nums)
    print("fma" if fma else "plain", nn, "mismatched", int((sim != ref).sum()), "of", a.size)
