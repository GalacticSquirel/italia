#!/bin/zsh
# Round 11m grid: W10m + k (W11 - W10m), k in 0.3, 0.4, 0.5.
# Each point: build (CPU), predict bench + learner-v2 on :8096, delete. Then score snap (and raw) +
# by-level under/over. Logs to ~/italia-diag/r11m-pipeline.log.
set -u
cd ~/code/italia/training && source mac.local.sh
LOG=~/italia-diag/r11m-pipeline.log
M=out/merged
step() { echo "=== $(date "+%F %T") $*" | tee -a $LOG; }
die() { step "FAILED: $*"; exit 1; }
delfused() {  # literal paths only
  case $1 in
    m11-k03) rm -rf /Users/owen/code/italia/training/out/merged/m11-k03 ;;
    m11-k04) rm -rf /Users/owen/code/italia/training/out/merged/m11-k04 ;;
    m11-k05) rm -rf /Users/owen/code/italia/training/out/merged/m11-k05 ;;
  esac
}
build() {  # build <name>
  case $1 in
    m11-k03) uv run --extra mlx python ~/italia-diag/merge.py $M/round10m $M/m11-k03 0.3 $M/round11-dpo $M/round10m ;;
    m11-k04) uv run --extra mlx python ~/italia-diag/merge.py $M/round10m $M/m11-k04 0.4 $M/round11-dpo $M/round10m ;;
    m11-k05) uv run --extra mlx python ~/italia-diag/merge.py $M/round10m $M/m11-k05 0.5 $M/round11-dpo $M/round10m ;;
  esac 2>&1 | tail -1 | tee -a $LOG
}
pkill -f "mlx_lm.server" 2>/dev/null; sleep 3
SYS=(m11-k03 m11-k04 m11-k05)
for n in $SYS; do
  if [[ $(grep -c "\"system\": \"$n\"" work/eval/bench-predictions.jsonl) -ge 801 && \
        $(grep -c "\"system\": \"$n\"" work/eval/learner-v2-predictions.jsonl) -ge 595 ]]; then continue; fi
  step "build $n"
  [[ -f $M/$n/model.safetensors ]] || build $n
  [[ -f $M/$n/model.safetensors ]] || die "build $n failed"
  .venv/bin/mlx_lm.server --model $M/$n --port 8098 --decode-concurrency 16 \
    --prompt-concurrency 4 >> ~/italia-diag/serve-r11m.log 2>&1 &
  ok=0; for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8098/v1/models | grep -q "$n" && { ok=1; break; }; sleep 5; done
  [[ $ok == 1 ]] || die "server $n did not start"
  uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/bench.jsonl \
    --out work/eval/bench-predictions.jsonl --system $n 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
  uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/learner-v2.jsonl \
    --out work/eval/learner-v2-predictions.jsonl --system $n 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
  pkill -f "mlx_lm.server"; sleep 3
  [[ $(grep -c "\"system\": \"$n\"" work/eval/bench-predictions.jsonl) -ge 801 ]] || die "bench predictions for $n incomplete"
  delfused $n
  step "predicted $n (fused copy deleted)"
done
step "score"
ALL=(m10-k04 round11-dpo $SYS)
SA=(); for s in $ALL; do SA+=(--system $s); done
PYTHONPATH=. uv run python ~/italia-diag/undercorrection.py work/eval/bench.jsonl \
  work/eval/bench-predictions.jsonl $ALL > ~/italia-diag/undercorrection-r11m.md 2>&1
PYTHONPATH=. uv run python ~/italia-diag/overcorrect.py $SYS m10-k04 > ~/italia-diag/r11m-overcorrect.jsonl 2>&1
W=~/code/italia/training/work/eval O=~/italia-diag/shipped
cd ~/italia-wt-main/training
for m in raw snap; do
  f=(); [[ $m != raw ]] && f=(--as-shipped $m)
  uv run python -m eval report -c datagen/configs/local-mac.yaml --no-languagetool \
    --items $W/bench.jsonl --predictions $W/bench-predictions.jsonl $SA $f \
    --out $O/r11m-bench-$m.md 2>&1 | grep -v httpx | tail -1
  uv run python -m eval learner-report --items $W/learner-v2.jsonl \
    --predictions $W/learner-v2-predictions.jsonl $SA $f --out $O/r11m-learner-$m.md 2>&1 | tail -1
done
step "done"
