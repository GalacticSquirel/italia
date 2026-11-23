#!/bin/zsh
# Round 9b: fused-weight interpolation W = W8 + k (W9 - W8) for k = 0.3, 0.5; predict bench +
# learner-v2, then delete each fused copy (rebuildable in minutes); score raw (main) and
# strict/snap (worktree); under/over-correction. No judge here. Logs to ~/italia-diag/r9b-pipeline.log.
set -u
cd ~/code/italia/training && source mac.local.sh
LOG=~/italia-diag/r9b-pipeline.log
step() { echo "=== $(date "+%F %T") $*" | tee -a $LOG; }
die() { step "FAILED: $*"; exit 1; }
pkill -f "mlx_lm.server" 2>/dev/null; sleep 3
for kp in 0.3:03:8096 0.5:05:8097; do
  k=${kp%%:*}; rest=${kp#*:}; n=${rest%%:*}; p=${rest#*:}
  step "interpolate k=$k"
  [[ -f out/merged/r9-k$n/model.safetensors ]] || uv run --extra mlx python ~/italia-diag/interp.py \
    out/merged/round8-sft out/merged/round9-dpo $k out/merged/r9-k$n 2>&1 | tail -1 | tee -a $LOG
  [[ -f out/merged/r9-k$n/model.safetensors ]] || die "interpolation k=$k failed"
  step "predict r9-k$n (port $p)"
  .venv/bin/mlx_lm.server --model out/merged/r9-k$n --port $p --decode-concurrency 16 \
    --prompt-concurrency 4 >> ~/italia-diag/serve-r9b.log 2>&1 &
  ok=0; for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:$p/v1/models | grep -q "r9-k$n" && { ok=1; break; }; sleep 5; done
  [[ $ok == 1 ]] || die "server r9-k$n did not start"
  uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/bench.jsonl \
    --out work/eval/bench-predictions.jsonl --system r9-k$n 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
  uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/learner-v2.jsonl \
    --out work/eval/learner-v2-predictions.jsonl --system r9-k$n 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
  pkill -f "mlx_lm.server"; sleep 3
  [[ $(grep -c "\"system\": \"r9-k$n\"" work/eval/bench-predictions.jsonl) -ge 801 ]] || die "bench predictions for r9-k$n incomplete"
  rm -rf out/merged/r9-k$n
  step "deleted fused r9-k$n (predictions saved)"
done
step "score"
PYTHONPATH=. uv run python ~/italia-diag/undercorrection.py work/eval/bench.jsonl \
  work/eval/bench-predictions.jsonl round8-sft r9-k03 r9-k05 round9-dpo > ~/italia-diag/undercorrection-r9b.md 2>&1
PYTHONPATH=. uv run python ~/italia-diag/overcorrect.py r9-k03 r9-k05 round8-sft round9-dpo \
  > ~/italia-diag/r9b-overcorrect.jsonl 2>&1
W=~/code/italia/training/work/eval O=~/italia-diag/shipped
cd ~/italia-wt-main/training
for m in raw snap; do
  f=(); [[ $m != raw ]] && f=(--as-shipped $m)
  uv run python -m eval report -c datagen/configs/local-mac.yaml --no-languagetool \
    --items $W/bench.jsonl --predictions $W/bench-predictions.jsonl \
    --system round8-sft --system r9-k03 --system r9-k05 --system round9-dpo $f \
    --out $O/r9b-bench-$m.md 2>&1 | grep -v httpx | tail -1
  uv run python -m eval learner-report --items $W/learner-v2.jsonl \
    --predictions $W/learner-v2-predictions.jsonl --system round8-sft --system r9-k03 \
    --system r9-k05 --system round9-dpo $f --out $O/r9b-learner-$m.md 2>&1 | tail -1
done
step "done"
