#!/bin/zsh
# Round 6: after the round-5 DPO chain finishes, SFT from base on work/sft-round6 (io->tu rows
# filtered), same recipe as round5-sft; fuse; predict bench + learner-v2; judged report vs round5-sft.
# Logs to ~/italia-diag/r6-pipeline.log.
set -u
cd ~/code/italia/training && source mac.local.sh
LOG=~/italia-diag/r6-pipeline.log
step() { echo "=== $(date '+%F %T') $*" | tee -a $LOG; }
die() { step "FAILED: $*"; exit 1; }

step "waiting for the round-5 DPO chain"
until grep -qE "=== .* (done|FAILED)" ~/italia-diag/r5d-pipeline.log 2>/dev/null; do sleep 60; done
tail -1 ~/italia-diag/r5d-pipeline.log | tee -a $LOG
pkill -f "datagen.serve_teacher" 2>/dev/null; pkill -f "mlx_lm.server" 2>/dev/null; sleep 5

step "SFT round6 from base ($(wc -l < work/sft-round6/sft.train.jsonl | tr -d ' ') train rows)"
if [[ ! -f out/mlx/round6-sft/final/weights.safetensors ]]; then
  caffeinate -dimsu uv run --extra mlx python -m train.sft -c train/configs/mlx/sft-gemma4-e4b-lora.yaml \
    --set outputDir=out/mlx/round6-sft --set trainFile=work/sft-round6/sft.train.jsonl \
    --set valFile=work/sft-round6/sft.val.jsonl >> ~/code/italia/training/sft-round6.log 2>&1 \
    || die "SFT failed (see sft-round6.log)"
fi
grep -E "validation" sft-round6.log | tail -1 | tee -a $LOG

step "fuse round6-sft"
[[ -f out/merged/round6-sft/model.safetensors ]] || \
  uv run --extra mlx python -m export mlx-fuse --model out/mlx/round6-sft/final \
    --out out/merged/round6-sft 2>&1 | tail -1 | tee -a $LOG

step "predict round6-sft: bench + learner-v2"
.venv/bin/mlx_lm.server --model out/merged/round6-sft --port 8091 --decode-concurrency 16 \
  --prompt-concurrency 4 >> ~/italia-diag/serve-r6.log 2>&1 &
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8091/v1/models >/dev/null && break; sleep 5; done
uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/bench.jsonl \
  --out work/eval/bench-predictions.jsonl --system round6-sft 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/learner-v2.jsonl \
  --out work/eval/learner-v2-predictions.jsonl --system round6-sft 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
pkill -f "mlx_lm.server"; sleep 3
uv run python -m eval learner-report --items work/eval/learner-v2.jsonl \
  --predictions work/eval/learner-v2-predictions.jsonl --system round6-sft \
  --out out/eval/learner-v2-round6-sft.md 2>&1 | grep -v httpx | tail -1 | tee -a $LOG

step "judge + report"
LOCAL_TEACHER_PORT=8081 caffeinate -dimsu scripts/serve-teacher.sh \
  mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit >> judge-server.log 2>&1 &
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8081/v1/models >/dev/null && break; sleep 5; done
export LOCAL_JUDGE_URL=http://127.0.0.1:8081/v1 LOCAL_JUDGE_MODEL=mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit
uv run python -m eval report -c datagen/configs/local-mac.yaml --items work/eval/bench.jsonl \
  --predictions work/eval/bench-predictions.jsonl \
  --system round5-sft --system round5-dpo --system round6-sft \
  --pairwise round6-sft:teacher-reference --pairwise round6-sft:round5-sft \
  --title "Round 6: SFT on round 1 + all hand-written incl. u-*, io->tu recasts filtered (801 items)" \
  --note "round6-sft = LoRA SFT from base on work/sft-round6 (5,154 rows after dropping 51 io->tu recast rows), same recipe as round5-sft" \
  --out out/eval/bench-round6.md 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
PYTHONPATH=. uv run python ~/italia-diag/undercorrection.py work/eval/bench.jsonl \
  work/eval/bench-predictions.jsonl round4-sft round5-sft round6-sft \
  > ~/italia-diag/undercorrection-r6.md 2>&1
pkill -f "datagen.serve_teacher"
step "done"
