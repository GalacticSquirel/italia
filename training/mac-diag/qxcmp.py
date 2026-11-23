import os, subprocess
import numpy as np
f32 = np.float32
a = np.fromfile("/tmp/q_in.f32", dtype=f32)
NUM = [f32(-32.0)] + [-(f32(32) + f32(0.1) * f32(i)) for i in range(-9, 10) if i != 0]

def acc(ta, tb, fma):
    s = np.zeros(ta.shape[0], f32)
    for i in range(ta.shape[1]):
        s = ((ta[:, i].astype(np.float64) * tb[:, i] + s).astype(f32) if fma else (ta[:, i] * tb[:, i] + s).astype(f32))
    return s

def scales(fma, wx_fma=False):
    x = a.reshape(-1, 16)
    idx = np.argmax(np.abs(x), axis=1); m = x[np.arange(len(x)), idx]
    safe = np.where(np.abs(m) >= 1e-15, m, f32(1)); w = x * x
    for k, num in enumerate(NUM):
        isc = (num / safe).astype(f32)
        l = np.clip(np.round(isc[:, None] * x), -32, 31).astype(f32)
        sumlx = acc((w * x).astype(f32), l, fma); suml2 = acc((w * l).astype(f32), l, fma)
        cand = np.where(suml2 > 0, sumlx / np.where(suml2 > 0, suml2, 1), 0).astype(f32)
        if k == 0: scale, best = cand, (cand * sumlx).astype(f32)
        else:
            if fma:  # sumlx*sumlx > best*suml2 : no contraction (no add)
                pass
            take = (suml2 > 0) & ((sumlx * sumlx).astype(f32) > (best * suml2).astype(f32))
            scale = np.where(take, cand, scale); best = np.where(take, (cand * sumlx).astype(f32), best)
    return scale

for c in ("on", "off"):
    subprocess.run([os.path.expanduser(f"~/italia-diag/qx_{c}"), str(a.size), "/tmp/q_in.f32", f"/tmp/qx_{c}.f32"], check=True)
ref = {c: np.fromfile(f"/tmp/qx_{c}.f32", dtype=f32) for c in ("on", "off")}
print("C on vs off differ:", int((ref["on"] != ref["off"]).sum()), "of", ref["on"].size)
for fma in (False, True):
    s = scales(fma)
    print("numpy", "fma" if fma else "plain", {c: int((s != ref[c]).sum()) for c in ref})
s = scales(True); i = np.nonzero(s != ref["on"])[0][:3]
print("examples", [(int(j), float(s[j]), float(ref["on"][j])) for j in i])
