#!/bin/zsh
set -u
cd ~/code/italia/training && source mac.local.sh
LOG=~/italia-diag/ship-pipeline.log
step() { echo "=== $(date "+%F %T") $*" | tee -a $LOG; }
step "Q4_0 unconstrained (no json_schema grammar) bench + learner-v2"
work/llama.cpp/build/bin/llama-server -m out/gguf-round12m/italia-tutor-e4b-q4_0-imat.gguf --port 8097 --alias italia-tutor-e4b-q4_0-imat \
  -c 65536 -np 8 -ngl 99 --jinja >> ~/italia-diag/serve-ship.log 2>&1 &
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8097/v1/models | grep -q italia-tutor && break; sleep 5; done
uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/bench.jsonl \
  --out work/eval/bench-predictions.jsonl --system round12m-q4-free 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/learner-v2.jsonl \
  --out work/eval/learner-v2-predictions.jsonl --system round12m-q4-free 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
pkill -f "llama-server -m"; sleep 3
W=~/code/italia/training/work/eval O=~/italia-diag/shipped
PYTHONPATH=. uv run python ~/italia-diag/undercorrection.py work/eval/bench.jsonl work/eval/bench-predictions.jsonl \
  m12-k04 round12m-q4 round12m-q4-free > ~/italia-diag/undercorrection-ship.md 2>&1
cd ~/italia-wt-main/training
for m in raw snap; do
  f=(); [[ $m != raw ]] && f=(--as-shipped $m)
  uv run python -m eval report -c datagen/configs/local-mac.yaml --no-languagetool \
    --items $W/bench.jsonl --predictions $W/bench-predictions.jsonl --system m12-k04 --system round12m-q4 --system round12m-q4-free $f \
    --out $O/ship2-bench-$m.md 2>&1 | grep -v httpx | tail -1
  uv run python -m eval learner-report --items $W/learner-v2.jsonl --predictions $W/learner-v2-predictions.jsonl \
    --system m12-k04 --system round12m-q4 --system round12m-q4-free $f --out $O/ship2-learner-$m.md 2>&1 | tail -1
done
step "free done"
