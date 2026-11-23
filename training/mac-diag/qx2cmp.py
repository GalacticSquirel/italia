import os, subprocess, sys
import numpy as np
sys.argv = ["x"]
f32 = np.float32
a = np.fromfile("/tmp/q_in.f32", dtype=f32)
subprocess.run([os.path.expanduser("~/italia-diag/qx2b"), str(a.size), "/tmp/q_in.f32"], check=True)
cd, csc, cy = (np.fromfile(p, dtype=f32) for p in ("/tmp/c_d.f32", "/tmp/c_sc.f32", "/tmp/c_y.f32"))
lib = np.fromfile("/tmp/q_out.f32", dtype=f32)  # from qref (library) on same input
print("gnu11 standalone vs library deq mismatches:", int((cy != lib.reshape(-1)).sum()) if lib.size == cy.size else "size differs")
exec(open(os.path.expanduser("~/italia-diag/qxcmp_core.py")).read())
