#!/bin/zsh
# Round 4: after round 3b's pipeline is done, SFT from base on round 1 + all hand-written sets
# (x, y, z; z-right-* kept as they are), same recipe as round3-sft, then benchmark with the
# PR #48 scorer against round3-sft and round3b-dpo. Logs to ~/italia-diag/r4-pipeline.log.
set -u
cd ~/code/italia/training && source mac.local.sh
export TARGET_DIALOGUES=10000
LOG=~/italia-diag/r4-pipeline.log
step() { echo "=== $(date '+%F %T') $*" | tee -a $LOG; }
die() { step "FAILED: $*"; exit 1; }

step "waiting for the round-3b pipeline"
until grep -qE "=== .* (done|FAILED)" ~/italia-diag/r3b-pipeline.log; do sleep 60; done
tail -1 ~/italia-diag/r3b-pipeline.log | tee -a $LOG
pkill -f "datagen.serve_teacher" 2>/dev/null; pkill -f "mlx_lm.server" 2>/dev/null; sleep 5

step "build-sft round 4"
[[ -s work/sft-round4/sft.train.jsonl ]] || \
  uv run python -m datagen build-sft -c datagen/configs/local-mac.yaml --out work/sft-round4 \
    --extra "data/handwritten/*.jsonl" 2>&1 | grep -v httpx | tail -2 | tee -a $LOG

step "SFT round4 from base"
if [[ ! -f out/mlx/round4-sft/final/weights.safetensors ]]; then
  caffeinate -dimsu uv run --extra mlx python -m train.sft -c train/configs/mlx/sft-gemma4-e4b-lora.yaml \
    --set outputDir=out/mlx/round4-sft --set trainFile=work/sft-round4/sft.train.jsonl \
    --set valFile=work/sft-round4/sft.val.jsonl >> ~/code/italia/training/sft-round4.log 2>&1 \
    || die "SFT failed (see sft-round4.log)"
fi
grep -E "validation" sft-round4.log | tail -1 | tee -a $LOG

step "fuse round4-sft"
[[ -f out/merged/round4-sft/model.safetensors ]] || \
  uv run --extra mlx python -m export mlx-fuse --model out/mlx/round4-sft/final \
    --out out/merged/round4-sft 2>&1 | tail -1 | tee -a $LOG

step "predict round4-sft: bench"
.venv/bin/mlx_lm.server --model out/merged/round4-sft --port 8088 --decode-concurrency 16 \
  --prompt-concurrency 4 >> ~/italia-diag/serve-r4.log 2>&1 &
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8088/v1/models >/dev/null && break; sleep 5; done
uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/bench.jsonl \
  --out work/eval/bench-predictions.jsonl --system round4-sft 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
pkill -f "mlx_lm.server"; sleep 3

step "judge + report"
LOCAL_TEACHER_PORT=8081 caffeinate -dimsu scripts/serve-teacher.sh \
  mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit >> judge-server.log 2>&1 &
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8081/v1/models >/dev/null && break; sleep 5; done
export LOCAL_JUDGE_URL=http://127.0.0.1:8081/v1 LOCAL_JUDGE_MODEL=mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit
uv run python -m eval report -c datagen/configs/local-mac.yaml --items work/eval/bench.jsonl \
  --predictions work/eval/bench-predictions.jsonl \
  --system round3-sft --system round3b-dpo --system round4-sft \
  --pairwise round3-sft:teacher-reference --pairwise round3b-dpo:teacher-reference \
  --pairwise round4-sft:teacher-reference \
  --title "Round 4: SFT on round 1 + x/y/z hand-written vs round3-sft and round3b-dpo (801 items)" \
  --note "round4-sft = LoRA SFT from base on round 1 + all hand-written (x, y, z incl. z-right-*); PR #48 recast scorer; mlx_lm.server, thinking off, no JSON constraint" \
  --out out/eval/bench-round4.md 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
PYTHONPATH=. uv run python ~/italia-diag/undercorrection.py work/eval/bench.jsonl \
  work/eval/bench-predictions.jsonl round2-handwritten round3-sft round3b-dpo round4-sft \
  > ~/italia-diag/undercorrection-r4.md 2>&1
pkill -f "datagen.serve_teacher"
step "done"
