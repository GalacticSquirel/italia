#!/bin/zsh
# Round 9m grid: W = W8 + a (W9 - W8) + b (W9c - W8), a in {0.4..0.7}, b in {0.7, 1.0}. Each point:
# build, predict bench + learner-v2 on :8096, delete. Then score raw/snap + under/over by level.
set -u
cd ~/code/italia/training && source mac.local.sh
LOG=~/italia-diag/r9m-pipeline.log
step() { echo "=== $(date "+%F %T") $*" | tee -a $LOG; }
die() { step "FAILED: $*"; exit 1; }
pkill -f "mlx_lm.server" 2>/dev/null; sleep 3
SYS=()
for a in 04 05 06 07; do for b in 07 10; do
  n=m-a$a-b$b; SYS+=($n)
  if [[ $(grep -c "\"system\": \"$n\"" work/eval/bench-predictions.jsonl) -ge 801 && \
        $(grep -c "\"system\": \"$n\"" work/eval/learner-v2-predictions.jsonl) -ge 595 ]]; then continue; fi
  step "build $n"
  [[ -f out/merged/$n/model.safetensors ]] || uv run --extra mlx python ~/italia-diag/interp2.py \
    out/merged/round8-sft out/merged/round9-dpo out/merged/round9c-dpo 0.${a#0} ${b:0:1}.${b:1} out/merged/$n \
    2>&1 | tail -1 | tee -a $LOG
  [[ -f out/merged/$n/model.safetensors ]] || die "build $n failed"
  .venv/bin/mlx_lm.server --model out/merged/$n --port 8096 --decode-concurrency 16 \
    --prompt-concurrency 4 >> ~/italia-diag/serve-r9m.log 2>&1 &
  ok=0; for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8096/v1/models | grep -q "$n" && { ok=1; break; }; sleep 5; done
  [[ $ok == 1 ]] || die "server $n did not start"
  uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/bench.jsonl \
    --out work/eval/bench-predictions.jsonl --system $n 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
  uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/learner-v2.jsonl \
    --out work/eval/learner-v2-predictions.jsonl --system $n 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
  pkill -f "mlx_lm.server"; sleep 3
  [[ $(grep -c "\"system\": \"$n\"" work/eval/bench-predictions.jsonl) -ge 801 ]] || die "bench predictions for $n incomplete"
  rm -rf out/merged/$n
  step "scored-ready $n (fused copy deleted)"
done; done
step "score"
SA=(); for s in round8-sft round9c-dpo $SYS; do SA+=(--system $s); done
PYTHONPATH=. uv run python ~/italia-diag/undercorrection.py work/eval/bench.jsonl \
  work/eval/bench-predictions.jsonl round8-sft round9c-dpo $SYS > ~/italia-diag/undercorrection-r9m.md 2>&1
PYTHONPATH=. uv run python ~/italia-diag/overcorrect.py $SYS round8-sft > ~/italia-diag/r9m-overcorrect.jsonl 2>&1
W=~/code/italia/training/work/eval O=~/italia-diag/shipped
cd ~/italia-wt-main/training
for m in raw snap; do
  f=(); [[ $m != raw ]] && f=(--as-shipped $m)
  uv run python -m eval report -c datagen/configs/local-mac.yaml --no-languagetool \
    --items $W/bench.jsonl --predictions $W/bench-predictions.jsonl $SA $f \
    --out $O/r9m-bench-$m.md 2>&1 | grep -v httpx | tail -1
  uv run python -m eval learner-report --items $W/learner-v2.jsonl \
    --predictions $W/learner-v2-predictions.jsonl $SA $f --out $O/r9m-learner-$m.md 2>&1 | tail -1
done
step "done"
