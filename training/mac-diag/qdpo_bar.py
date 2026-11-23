"""Pass bar for QAT-DPO vs mx2 (snap). Prints the table and PASS/FAIL; exit 0 on pass, 1 on fail.
usage: qdpo_bar.py bench-snap.json learner-snap.md system"""
import json, re, sys
b = json.load(open(sys.argv[1]))["systems"]
learn = open(sys.argv[2]).read()
def lv(s):
    m = re.search(rf"^\| {re.escape(s)} \| [\d.]+% \((\d+)/317\) \| [\d.]+% \((\d+)/278\)", learn, re.M)
    return (int(m.group(1)), int(m.group(2))) if m else (None, None)
rows = []
for s in ("m12-k04", "qat2-e2-mx2", sys.argv[3]):
    m = b[s]; d, f = lv(s)
    rows.append((s, 100 * m["over_correction"], 100 * m["under_correction"], 100 * m["recast_correctness"],
                 100 * m["correction_accuracy"], d, f))
print("| system | over | under | recast | corr acc | L-v2 det /317 | L-v2 false flags /278 |")
for r in rows:
    print("| %s | %.1f | %.1f | %.1f | %.1f | %s | %s |" % r)
s, o, u, rc, _, d, f = rows[-1]
checks = {"over <= 7.0": o <= 7.0, "under <= 13.0": u <= 13.0, "recast >= 66": rc >= 66.0,
          "L-v2 detection >= 252": d is not None and d >= 252, "L-v2 false flags <= 105": f is not None and f <= 105}
for k, v in checks.items():
    print(f"  {k}: {'pass' if v else 'FAIL'}")
ok = all(checks.values())
print("VERDICT:", "PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)
