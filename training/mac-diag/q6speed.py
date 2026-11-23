import os, sys, time
import mlx.core as mx
sys.path.insert(0, os.path.expanduser("~/italia-diag"))
import qat
w = (mx.random.normal((2560, 10240)) * 0.02).astype(mx.bfloat16)
o = (mx.random.normal((2560, 2048)) * 0.02).astype(mx.bfloat16)
cq6 = mx.compile(qat.q6_k)
for name, fn in (("q4_0", qat.q4_0), ("q6_k", qat.q6_k), ("q6_k compiled", cq6)):
    for _ in range(2):
        mx.eval(fn(w), fn(o))
    t = time.time()
    for _ in range(5):
        mx.eval(fn(w), fn(o))
    dt = (time.time() - t) / 5
    print(f"{name}: {dt*1000:.0f} ms per layer (down+o), x42 = {dt*42:.2f} s")
import numpy as np
print("compiled == eager:", bool(mx.all(cq6(w) == qat.q6_k(w)).item()))
