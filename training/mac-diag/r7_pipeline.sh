#!/bin/zsh
# Round 7: after the round-6 chain finishes, SFT from base on work/sft-round7 (round-6 mix + t-*),
# same recipe; fuse; predict bench + learner-v2; judged report vs round6-sft.
# Logs to ~/italia-diag/r7-pipeline.log.
set -u
cd ~/code/italia/training && source mac.local.sh
LOG=~/italia-diag/r7-pipeline.log
step() { echo "=== $(date '+%F %T') $*" | tee -a $LOG; }
die() { step "FAILED: $*"; exit 1; }

step "waiting for the round-6 chain"
until [[ $(grep -cE "=== .* done" ~/italia-diag/r6-pipeline.log) -ge 2 ]] || grep -q "FAILED" ~/italia-diag/r6-pipeline.log; do sleep 60; done
tail -1 ~/italia-diag/r6-pipeline.log | tee -a $LOG
pkill -f "datagen.serve_teacher" 2>/dev/null; pkill -f "mlx_lm.server" 2>/dev/null; sleep 5

step "SFT round6 from base ($(wc -l < work/sft-round7/sft.train.jsonl | tr -d ' ') train rows)"
if [[ ! -f out/mlx/round7-sft/final/weights.safetensors ]]; then
  caffeinate -dimsu uv run --extra mlx python -m train.sft -c train/configs/mlx/sft-gemma4-e4b-lora.yaml \
    --set outputDir=out/mlx/round7-sft --set trainFile=work/sft-round7/sft.train.jsonl \
    --set valFile=work/sft-round7/sft.val.jsonl >> ~/code/italia/training/sft-round7.log 2>&1 \
    || die "SFT failed (see sft-round7.log)"
fi
grep -E "validation" sft-round7.log | tail -1 | tee -a $LOG

step "fuse round7-sft"
[[ -f out/merged/round7-sft/model.safetensors ]] || \
  uv run --extra mlx python -m export mlx-fuse --model out/mlx/round7-sft/final \
    --out out/merged/round7-sft 2>&1 | tail -1 | tee -a $LOG

step "predict round7-sft: bench + learner-v2"
.venv/bin/mlx_lm.server --model out/merged/round7-sft --port 8092 --decode-concurrency 16 \
  --prompt-concurrency 4 >> ~/italia-diag/serve-r7.log 2>&1 &
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8092/v1/models >/dev/null && break; sleep 5; done
uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/bench.jsonl \
  --out work/eval/bench-predictions.jsonl --system round7-sft 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/learner-v2.jsonl \
  --out work/eval/learner-v2-predictions.jsonl --system round7-sft 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
pkill -f "mlx_lm.server"; sleep 3
uv run python -m eval learner-report --items work/eval/learner-v2.jsonl \
  --predictions work/eval/learner-v2-predictions.jsonl --system round7-sft \
  --out out/eval/learner-v2-round7-sft.md 2>&1 | grep -v httpx | tail -1 | tee -a $LOG

step "judge + report"
LOCAL_TEACHER_PORT=8081 caffeinate -dimsu scripts/serve-teacher.sh \
  mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit >> judge-server.log 2>&1 &
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8081/v1/models >/dev/null && break; sleep 5; done
export LOCAL_JUDGE_URL=http://127.0.0.1:8081/v1 LOCAL_JUDGE_MODEL=mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit
uv run python -m eval report -c datagen/configs/local-mac.yaml --items work/eval/bench.jsonl \
  --predictions work/eval/bench-predictions.jsonl \
  --system round5-sft --system round6-sft --system round7-sft \
  --pairwise round7-sft:teacher-reference --pairwise round7-sft:round6-sft \
  --title "Round 7: SFT on round-6 mix + t-* (801 items)" \
  --note "round7-sft = LoRA SFT from base on work/sft-round7 (5,653 rows: filtered round-6 mix + 499 t-* train rows), same recipe" \
  --out out/eval/bench-round7.md 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
PYTHONPATH=. uv run python ~/italia-diag/undercorrection.py work/eval/bench.jsonl \
  work/eval/bench-predictions.jsonl round5-sft round6-sft round7-sft \
  > ~/italia-diag/undercorrection-r7.md 2>&1
pkill -f "datagen.serve_teacher"
step "done"
