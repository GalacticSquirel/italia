#!/bin/zsh
set -u
cd ~/code/italia/training
W=~/code/italia/training/work/eval O=~/italia-diag/gate
mkdir -p $O
for x in bench learner-v2; do
  echo "== $x"; PYTHONPATH=. uv run python ~/italia-diag/gate.py $W/$x.jsonl $W/$x-predictions.jsonl $O/$x-predictions.jsonl qat2-e2-mx2 m12-k04
done
SA=(); for s in m12-k04 m12-k04-ga m12-k04-gb m12-k04-gc qat2-e2-mx2 qat2-e2-mx2-ga qat2-e2-mx2-gb qat2-e2-mx2-gc; do SA+=(--system $s); done
cd ~/italia-wt-main/training
uv run python -m eval report -c datagen/configs/local-mac.yaml --no-languagetool --items $W/bench.jsonl \
  --predictions $O/bench-predictions.jsonl $SA --as-shipped snap --out $O/gate-bench-snap.md 2>&1 | grep -v httpx | tail -1
uv run python -m eval learner-report --items $W/learner-v2.jsonl --predictions $O/learner-v2-predictions.jsonl \
  $SA --as-shipped snap --out $O/gate-learner-snap.md 2>&1 | tail -1
echo gate done
