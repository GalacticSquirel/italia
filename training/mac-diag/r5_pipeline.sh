#!/bin/zsh
# Round 5: wait for the round-5 SFT (already running in tmux sft5), fuse, predict bench + MERLIN
# learner-v2 set, judge against round4-sft, under-correction tables, learner report, failure export;
# then round4-sft on learner-v2 for comparison. Logs to ~/italia-diag/r5-pipeline.log.
set -u
cd ~/code/italia/training && source mac.local.sh
LOG=~/italia-diag/r5-pipeline.log
step() { echo "=== $(date '+%F %T') $*" | tee -a $LOG; }
die() { step "FAILED: $*"; exit 1; }

step "waiting for SFT round5"
until [[ -f out/mlx/round5-sft/final/weights.safetensors ]]; do
  pgrep -f "train.sft.*round5" >/dev/null || { sleep 30; [[ -f out/mlx/round5-sft/final/weights.safetensors ]] || die "SFT exited without final weights (see sft-round5.log)"; }
  sleep 60
done
grep -E "validation" sft-round5.log | tail -1 | tee -a $LOG

step "fuse round5-sft"
[[ -f out/merged/round5-sft/model.safetensors ]] || \
  uv run --extra mlx python -m export mlx-fuse --model out/mlx/round5-sft/final \
    --out out/merged/round5-sft 2>&1 | tail -1 | tee -a $LOG

step "predict round5-sft: bench + learner-v2"
.venv/bin/mlx_lm.server --model out/merged/round5-sft --port 8089 --decode-concurrency 16 \
  --prompt-concurrency 4 >> ~/italia-diag/serve-r5.log 2>&1 &
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8089/v1/models >/dev/null && break; sleep 5; done
uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/bench.jsonl \
  --out work/eval/bench-predictions.jsonl --system round5-sft 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/learner-v2.jsonl \
  --out work/eval/learner-v2-predictions.jsonl --system round5-sft 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
pkill -f "mlx_lm.server"; sleep 3

step "learner-v2 report round5-sft"
uv run python -m eval learner-report --items work/eval/learner-v2.jsonl \
  --predictions work/eval/learner-v2-predictions.jsonl --system round5-sft \
  --out out/eval/learner-v2-round5-sft.md 2>&1 | grep -v httpx | tail -3 | tee -a $LOG

step "judge + report"
LOCAL_TEACHER_PORT=8081 caffeinate -dimsu scripts/serve-teacher.sh \
  mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit >> judge-server.log 2>&1 &
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8081/v1/models >/dev/null && break; sleep 5; done
export LOCAL_JUDGE_URL=http://127.0.0.1:8081/v1 LOCAL_JUDGE_MODEL=mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit
uv run python -m eval report -c datagen/configs/local-mac.yaml --items work/eval/bench.jsonl \
  --predictions work/eval/bench-predictions.jsonl \
  --system round4-sft --system round5-sft \
  --pairwise round4-sft:teacher-reference --pairwise round5-sft:teacher-reference \
  --pairwise round5-sft:round4-sft \
  --title "Round 5: SFT on round 1 + x/y/z/w/v hand-written vs round4-sft (801 items)" \
  --note "round5-sft = LoRA SFT from base on round 1 + all hand-written (x, y, z, w, v), same recipe as round4-sft; mlx_lm.server, thinking off" \
  --out out/eval/bench-round5.md 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
PYTHONPATH=. uv run python ~/italia-diag/undercorrection.py work/eval/bench.jsonl \
  work/eval/bench-predictions.jsonl round3-sft round4-sft round5-sft \
  > ~/italia-diag/undercorrection-r5.md 2>&1
LEARNER_ITEMS=work/eval/learner-v2.jsonl LEARNER_PREDS=work/eval/learner-v2-predictions.jsonl \
  PYTHONPATH=. uv run python ~/italia-diag/r4_export.py round5-sft ~/italia-diag/round5-failures.jsonl 2>&1 | tail -1 | tee -a $LOG
pkill -f "datagen.serve_teacher"; sleep 3

step "round4-sft on learner-v2"
.venv/bin/mlx_lm.server --model out/merged/round4-sft --port 8088 --decode-concurrency 16 \
  --prompt-concurrency 4 >> ~/italia-diag/serve-r4.log 2>&1 &
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8088/v1/models >/dev/null && break; sleep 5; done
uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/learner-v2.jsonl \
  --out work/eval/learner-v2-predictions.jsonl --system round4-sft 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
pkill -f "mlx_lm.server"; sleep 3
uv run python -m eval learner-report --items work/eval/learner-v2.jsonl \
  --predictions work/eval/learner-v2-predictions.jsonl --system round4-sft \
  --out out/eval/learner-v2-round4-sft.md 2>&1 | grep -v httpx | tail -3 | tee -a $LOG
step "done"
