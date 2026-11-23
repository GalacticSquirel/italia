#!/bin/zsh
# Round 5 DPO: on-policy pairs from round5-sft on its own train split, balanced ~2:1
# no-correction : correction, DPO with sftLossWeight 0.5, then benchmark round5-dpo vs round5-sft
# (bench + learner-v2). Logs to ~/italia-diag/r5d-pipeline.log; finished steps are skipped on rerun.
set -u
cd ~/code/italia/training && source mac.local.sh
LOG=~/italia-diag/r5d-pipeline.log
D=work/dpo-round5
mkdir -p $D
step() { echo "=== $(date '+%F %T') $*" | tee -a $LOG; }
die() { step "FAILED: $*"; exit 1; }
serve() {  # serve <model dir> <port>
  pkill -f "mlx_lm.server" 2>/dev/null; sleep 3
  .venv/bin/mlx_lm.server --model "$1" --port "$2" --decode-concurrency 16 --prompt-concurrency 4 \
    >> ~/italia-diag/serve-r5d.log 2>&1 &
  for i in $(seq 1 60); do curl -s -m 3 "http://127.0.0.1:$2/v1/models" >/dev/null && return 0; sleep 5; done
  die "server for $1 did not start"
}
predict() {  # predict <system> <items> <out>
  uv run python -m eval predict --systems work/eval/systems-mac.yaml --items "$2" --out "$3" \
    --system "$1" 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
}

step "predict round5-sft: train items"
serve out/merged/round5-sft 8089
predict round5-sft work/eval/train-items-r5.jsonl $D/predictions.jsonl
pkill -f "mlx_lm.server"; sleep 3

step "pairs + 2:1 balance"
PYTHONPATH=. uv run python ~/italia-diag/r3_pairs.py work/eval/train-items-r5.jsonl $D/predictions.jsonl \
  round5-sft $D/pairs-raw.jsonl 2>&1 | grep -v httpx | tail -4 | tee -a $LOG
PYTHONPATH=. uv run python ~/italia-diag/r5d_balance.py $D/pairs-raw.jsonl $D/pairs.jsonl 2>&1 | tee -a $LOG
[[ -s $D/pairs.jsonl ]] || die "no pairs"

step "DPO round5 on round5-sft (2:1, sftLossWeight 0.5)"
if [[ ! -f out/mlx/round5-dpo/final/weights.safetensors ]]; then
  caffeinate -dimsu uv run --extra mlx python -m train.dpo -c train/configs/mlx/dpo-gemma4-e4b.yaml \
    --set policyModel=out/mlx/round5-sft/final --set pairsFile=$D/pairs.jsonl \
    --set sftLossWeight=0.5 --set outputDir=out/mlx/round5-dpo >> ~/italia-diag/dpo-round5.log 2>&1 \
    || die "DPO failed (see dpo-round5.log)"
fi
grep -E "validation|saved" ~/italia-diag/dpo-round5.log | tail -2 | tee -a $LOG

step "fuse round5-dpo"
[[ -f out/merged/round5-dpo/model.safetensors ]] || \
  uv run --extra mlx python -m export mlx-fuse --model out/mlx/round5-dpo/final \
    --out out/merged/round5-dpo 2>&1 | tail -1 | tee -a $LOG

step "predict round5-dpo: bench + learner-v2"
serve out/merged/round5-dpo 8090
predict round5-dpo work/eval/bench.jsonl work/eval/bench-predictions.jsonl
predict round5-dpo work/eval/learner-v2.jsonl work/eval/learner-v2-predictions.jsonl
pkill -f "mlx_lm.server"; sleep 3
uv run python -m eval learner-report --items work/eval/learner-v2.jsonl \
  --predictions work/eval/learner-v2-predictions.jsonl --system round5-dpo \
  --out out/eval/learner-v2-round5-dpo.md 2>&1 | grep -v httpx | tail -1 | tee -a $LOG

step "judge + report"
LOCAL_TEACHER_PORT=8081 caffeinate -dimsu scripts/serve-teacher.sh \
  mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit >> judge-server.log 2>&1 &
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8081/v1/models >/dev/null && break; sleep 5; done
export LOCAL_JUDGE_URL=http://127.0.0.1:8081/v1 LOCAL_JUDGE_MODEL=mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit
uv run python -m eval report -c datagen/configs/local-mac.yaml --items work/eval/bench.jsonl \
  --predictions work/eval/bench-predictions.jsonl \
  --system round4-sft --system round5-sft --system round5-dpo \
  --pairwise round5-dpo:teacher-reference --pairwise round5-dpo:round5-sft \
  --title "Round 5 DPO: 2:1 on-policy DPO on round5-sft (801 items)" \
  --note "round5-dpo = DPO on round5-sft, on-policy pairs from its train split balanced ~2:1 no-correction : correction, sftLossWeight 0.5; mlx_lm.server, thinking off" \
  --out out/eval/bench-round5-dpo.md 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
PYTHONPATH=. uv run python ~/italia-diag/undercorrection.py work/eval/bench.jsonl \
  work/eval/bench-predictions.jsonl round4-sft round5-sft round5-dpo \
  > ~/italia-diag/undercorrection-r5d.md 2>&1
pkill -f "datagen.serve_teacher"
step "done"
