#!/bin/zsh
# Round 10m grid: (1) W10 + k (W10b - W10), k in 0.3..0.6; (2) W10b + g (W9 - W8), g in 0.3, 0.5.
# Each point: build (CPU), predict bench + learner-v2 on :8096, delete. Then score snap (and raw) +
# by-level under/over. Logs to ~/italia-diag/r10m-pipeline.log.
set -u
cd ~/code/italia/training && source mac.local.sh
LOG=~/italia-diag/r10m-pipeline.log
M=out/merged
step() { echo "=== $(date "+%F %T") $*" | tee -a $LOG; }
die() { step "FAILED: $*"; exit 1; }
delfused() {  # literal paths only
  case $1 in
    m10-k03) rm -rf /Users/owen/code/italia/training/out/merged/m10-k03 ;;
    m10-k04) rm -rf /Users/owen/code/italia/training/out/merged/m10-k04 ;;
    m10-k05) rm -rf /Users/owen/code/italia/training/out/merged/m10-k05 ;;
    m10-k06) rm -rf /Users/owen/code/italia/training/out/merged/m10-k06 ;;
    m10b-g03) rm -rf /Users/owen/code/italia/training/out/merged/m10b-g03 ;;
    m10b-g05) rm -rf /Users/owen/code/italia/training/out/merged/m10b-g05 ;;
    round9-dpo) rm -rf /Users/owen/code/italia/training/out/merged/round9-dpo ;;
  esac
}
build() {  # build <name>
  case $1 in
    m10-k03) uv run --extra mlx python ~/italia-diag/merge.py $M/round10-dpo $M/m10-k03 0.3 $M/round10b-dpo $M/round10-dpo ;;
    m10-k04) uv run --extra mlx python ~/italia-diag/merge.py $M/round10-dpo $M/m10-k04 0.4 $M/round10b-dpo $M/round10-dpo ;;
    m10-k05) uv run --extra mlx python ~/italia-diag/merge.py $M/round10-dpo $M/m10-k05 0.5 $M/round10b-dpo $M/round10-dpo ;;
    m10-k06) uv run --extra mlx python ~/italia-diag/merge.py $M/round10-dpo $M/m10-k06 0.6 $M/round10b-dpo $M/round10-dpo ;;
    m10b-g03) uv run --extra mlx python ~/italia-diag/merge.py $M/round10b-dpo $M/m10b-g03 0.3 $M/round9-dpo $M/round8-sft ;;
    m10b-g05) uv run --extra mlx python ~/italia-diag/merge.py $M/round10b-dpo $M/m10b-g05 0.5 $M/round9-dpo $M/round8-sft ;;
  esac 2>&1 | tail -1 | tee -a $LOG
}
pkill -f "mlx_lm.server" 2>/dev/null; sleep 3
step "rebuild fused round9-dpo from its adapter"
[[ -f $M/round9-dpo/model.safetensors ]] || uv run --extra mlx python -m export mlx-fuse \
  --model out/mlx/round9-dpo/final --out $M/round9-dpo 2>&1 | tail -1 | tee -a $LOG
[[ -f $M/round9-dpo/model.safetensors ]] || die "round9-dpo fuse failed"
SYS=(m10-k03 m10-k04 m10-k05 m10-k06 m10b-g03 m10b-g05)
for n in $SYS; do
  if [[ $(grep -c "\"system\": \"$n\"" work/eval/bench-predictions.jsonl) -ge 801 && \
        $(grep -c "\"system\": \"$n\"" work/eval/learner-v2-predictions.jsonl) -ge 595 ]]; then continue; fi
  step "build $n"
  [[ -f $M/$n/model.safetensors ]] || build $n
  [[ -f $M/$n/model.safetensors ]] || die "build $n failed"
  .venv/bin/mlx_lm.server --model $M/$n --port 8096 --decode-concurrency 16 \
    --prompt-concurrency 4 >> ~/italia-diag/serve-r10m.log 2>&1 &
  ok=0; for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8096/v1/models | grep -q "$n" && { ok=1; break; }; sleep 5; done
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
delfused round9-dpo
step "score"
ALL=(round10-dpo round10b-dpo $SYS)
SA=(); for s in $ALL; do SA+=(--system $s); done
PYTHONPATH=. uv run python ~/italia-diag/undercorrection.py work/eval/bench.jsonl \
  work/eval/bench-predictions.jsonl $ALL > ~/italia-diag/undercorrection-r10m.md 2>&1
PYTHONPATH=. uv run python ~/italia-diag/overcorrect.py $SYS round10-dpo > ~/italia-diag/r10m-overcorrect.jsonl 2>&1
W=~/code/italia/training/work/eval O=~/italia-diag/shipped
cd ~/italia-wt-main/training
for m in raw snap; do
  f=(); [[ $m != raw ]] && f=(--as-shipped $m)
  uv run python -m eval report -c datagen/configs/local-mac.yaml --no-languagetool \
    --items $W/bench.jsonl --predictions $W/bench-predictions.jsonl $SA $f \
    --out $O/r10m-bench-$m.md 2>&1 | grep -v httpx | tail -1
  uv run python -m eval learner-report --items $W/learner-v2.jsonl \
    --predictions $W/learner-v2-predictions.jsonl $SA $f --out $O/r10m-learner-$m.md 2>&1 | tail -1
done
step "done"
