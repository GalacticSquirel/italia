#!/bin/zsh
# Round 8: SFT from base on work/sft-round8 (round-7 mix + s-*), same recipe as round 7; fuse;
# predict bench + learner-v2; judged report with pairwise round8 vs round7-sft. No DPO.
# Logs to ~/italia-diag/r8-pipeline.log.
set -u
cd ~/code/italia/training && source mac.local.sh
LOG=~/italia-diag/r8-pipeline.log
step() { echo "=== $(date '+%F %T') $*" | tee -a $LOG; }
die() { step "FAILED: $*"; exit 1; }
pkill -f "datagen.serve_teacher" 2>/dev/null; pkill -f "mlx_lm.server" 2>/dev/null; sleep 5

step "SFT round8 from base ($(wc -l < work/sft-round8/sft.train.jsonl | tr -d ' ') train rows)"
if [[ ! -f out/mlx/round8-sft/final/weights.safetensors ]]; then
  caffeinate -dimsu uv run --extra mlx python -m train.sft -c train/configs/mlx/sft-gemma4-e4b-lora.yaml \
    --set outputDir=out/mlx/round8-sft --set trainFile=work/sft-round8/sft.train.jsonl \
    --set valFile=work/sft-round8/sft.val.jsonl >> ~/code/italia/training/sft-round8.log 2>&1 \
    || die "SFT failed (see sft-round8.log)"
fi
grep -E "validation" sft-round8.log | tail -1 | tee -a $LOG

step "fuse round8-sft"
[[ -f out/merged/round8-sft/model.safetensors ]] || \
  uv run --extra mlx python -m export mlx-fuse --model out/mlx/round8-sft/final \
    --out out/merged/round8-sft 2>&1 | tail -1 | tee -a $LOG
[[ -f out/merged/round8-sft/model.safetensors ]] || die "fuse failed"

step "predict round8-sft: bench + learner-v2"
.venv/bin/mlx_lm.server --model out/merged/round8-sft --port 8093 --decode-concurrency 16 \
  --prompt-concurrency 4 >> ~/italia-diag/serve-r8.log 2>&1 &
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8093/v1/models >/dev/null && break; sleep 5; done
uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/bench.jsonl \
  --out work/eval/bench-predictions.jsonl --system round8-sft 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/learner-v2.jsonl \
  --out work/eval/learner-v2-predictions.jsonl --system round8-sft 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
pkill -f "mlx_lm.server"; sleep 3
uv run python -m eval learner-report --items work/eval/learner-v2.jsonl \
  --predictions work/eval/learner-v2-predictions.jsonl --system round8-sft \
  --out out/eval/learner-v2-round8-sft.md 2>&1 | grep -v httpx | tail -1 | tee -a $LOG

step "judge + report"
LOCAL_TEACHER_PORT=8081 caffeinate -dimsu scripts/serve-teacher.sh \
  mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit >> judge-server.log 2>&1 &
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8081/v1/models >/dev/null && break; sleep 5; done
export LOCAL_JUDGE_URL=http://127.0.0.1:8081/v1 LOCAL_JUDGE_MODEL=mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit
uv run python -m eval report -c datagen/configs/local-mac.yaml --items work/eval/bench.jsonl \
  --predictions work/eval/bench-predictions.jsonl \
  --system round6-sft --system round7-sft --system round8-sft \
  --pairwise round8-sft:teacher-reference --pairwise round8-sft:round7-sft \
  --title "Round 8: SFT on round-7 mix + s-* (801 items)" \
  --note "round8-sft = LoRA SFT from base on work/sft-round8 (round-7 mix + s-* train rows), same recipe, no DPO" \
  --out out/eval/bench-round8.md 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
pkill -f "datagen.serve_teacher"
PYTHONPATH=. uv run python ~/italia-diag/undercorrection.py work/eval/bench.jsonl \
  work/eval/bench-predictions.jsonl round6-sft round7-sft round8-sft \
  > ~/italia-diag/undercorrection-r8.md 2>&1
PYTHONPATH=. uv run python ~/italia-diag/overcorrect.py round8-sft round7-sft \
  > ~/italia-diag/round8-sft-overcorrect.jsonl 2>&1
step "done"
