NUM = [f32(-32.0)] + [-(f32(32) + f32(0.1) * f32(i)) for i in range(-9, 10) if i != 0]
def acc(ta, tb):
    s = np.zeros(ta.shape[0], f32)
    for i in range(ta.shape[1]):
        s = (ta[:, i].astype(np.float64) * tb[:, i] + s).astype(f32)
    return s
x = a.reshape(-1, 16)
idx = np.argmax(np.abs(x), axis=1); m = x[np.arange(len(x)), idx]
safe = np.where(np.abs(m) >= 1e-15, m, f32(1)); w = x * x
for k, num in enumerate(NUM):
    isc = (num / safe).astype(f32)
    l = np.clip(np.round(isc[:, None] * x), -32, 31).astype(f32)
    sumlx = acc((w * x).astype(f32), l); suml2 = acc((w * l).astype(f32), l)
    cand = np.where(suml2 > 0, sumlx / np.where(suml2 > 0, suml2, 1), 0).astype(f32)
    if k == 0: scale, best = cand, (cand * sumlx).astype(f32)
    else:
        take = (suml2 > 0) & ((sumlx * sumlx).astype(f32) > (best * suml2).astype(f32))
        scale = np.where(take, cand, scale); best = np.where(take, (cand * sumlx).astype(f32), best)
scale = scale.reshape(-1, 16)
si = np.argmax(np.abs(scale), axis=1); ms = scale[np.arange(len(scale)), si]
isc = (f32(-128) / ms).astype(f32)
d16 = (f32(1) / isc).astype(np.float16).astype(f32)
print("d mismatches", int((d16 != cd).sum()), "of", cd.size)
sc = np.minimum(f32(127), np.round((isc[:, None] * scale).astype(f32)))
print("sc mismatches", int((sc.reshape(-1) != csc).sum()), "of", csc.size)
scf = np.minimum(f32(127), np.round(isc[:, None].astype(np.float64) * scale))
print("sc(fma) mismatches", int((scf.reshape(-1) != csc).sum()))
sc = csc.reshape(-1, 16)
dd = (cd[:, None] * sc).astype(f32).reshape(-1, 1)
q = np.clip(np.round((x / np.where(dd != 0, dd, f32(1))).astype(f32)), -32, 31)
y = np.where(dd != 0, dd * q, f32(0)).astype(f32).reshape(-1)
print("deq given C d/sc mismatches", int((y != cy).sum()))
j = np.nonzero(y != cy)[0][:5]
print([(int(t), float(a[t]), float(y[t]), float(cy[t]), float(dd.reshape(-1)[t // 16])) for t in j])
sc0 = np.minimum(f32(127), np.round((isc[:, None] * scale).astype(f32)))
bad = np.nonzero(sc0.reshape(-1) != csc)[0]
print("sc-mismatch superblocks:", sorted(set((bad // 16).tolist()))[:20], "d-mismatch superblocks:", np.nonzero(d16 != cd)[0].tolist())
for t in bad[:6]:
    b = t // 16
    print(f"sb {b} sub {t%16}: scale {scale.reshape(-1)[t]!r} isc {isc[b]!r} prod {np.float64(isc[b])*np.float64(scale.reshape(-1)[t])!r} mine {sc0.reshape(-1)[t]} C {csc[t]} | ms {ms[b]!r} d16 {d16[b]!r} Cd {cd[b]!r}")
