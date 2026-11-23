#!/bin/zsh
# Round 3b: DPO on round3-sft with balanced pairs (no-correction : correction = 1:1) and a
# stronger SFT anchor, then benchmark round3-sft vs round3b-dpo (with round 2 for reference).
# Logs to ~/italia-diag/r3b-pipeline.log; finished steps are skipped on a rerun.
set -u
cd ~/code/italia/training && source mac.local.sh
export TARGET_DIALOGUES=10000
LOG=~/italia-diag/r3b-pipeline.log
step() { echo "=== $(date '+%F %T') $*" | tee -a $LOG; }
die() { step "FAILED: $*"; exit 1; }
serve() {
  pkill -f "mlx_lm.server" 2>/dev/null; sleep 3
  .venv/bin/mlx_lm.server --model "$1" --port "$2" --decode-concurrency 16 --prompt-concurrency 4 \
    >> ~/italia-diag/serve-r3b.log 2>&1 &
  for i in $(seq 1 60); do curl -s -m 3 "http://127.0.0.1:$2/v1/models" >/dev/null && return 0; sleep 5; done
  die "server for $1 did not start"
}

step "DPO round3b on round3-sft (balanced pairs, sftLossWeight 0.5)"
if [[ ! -f out/mlx/round3b-dpo/final/weights.safetensors ]]; then
  caffeinate -dimsu uv run --extra mlx python -m train.dpo -c train/configs/mlx/dpo-gemma4-e4b.yaml \
    --set policyModel=out/mlx/round3-sft/final --set pairsFile=work/dpo-round3b/pairs.jsonl \
    --set sftLossWeight=0.5 --set outputDir=out/mlx/round3b-dpo >> ~/italia-diag/dpo-round3b.log 2>&1 \
    || die "DPO failed (see dpo-round3b.log)"
fi
grep -E "validation|saved" ~/italia-diag/dpo-round3b.log | tail -2 | tee -a $LOG

step "fuse round3b-dpo"
[[ -f out/merged/round3b-dpo/model.safetensors ]] || \
  uv run --extra mlx python -m export mlx-fuse --model out/mlx/round3b-dpo/final \
    --out out/merged/round3b-dpo 2>&1 | tail -1 | tee -a $LOG

step "predict round3b-dpo: bench"
serve out/merged/round3b-dpo 8087
uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/bench.jsonl \
  --out work/eval/bench-predictions.jsonl --system round3b-dpo 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
pkill -f "mlx_lm.server"; sleep 3

step "judge + report"
LOCAL_TEACHER_PORT=8081 caffeinate -dimsu scripts/serve-teacher.sh \
  mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit >> judge-server.log 2>&1 &
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8081/v1/models >/dev/null && break; sleep 5; done
export LOCAL_JUDGE_URL=http://127.0.0.1:8081/v1 LOCAL_JUDGE_MODEL=mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit
uv run python -m eval report -c datagen/configs/local-mac.yaml --items work/eval/bench.jsonl \
  --predictions work/eval/bench-predictions.jsonl \
  --system round2-handwritten --system round3-sft --system round3b-dpo \
  --pairwise round3-sft:teacher-reference --pairwise round3b-dpo:teacher-reference \
  --title "Round 3b: balanced on-policy DPO on round3-sft (801 items)" \
  --note "round3b-dpo = DPO on round3-sft, 2,250 rows: 375 no-correction pairs x3 + 1,125 correction pairs (weak areas first), sftLossWeight 0.5; mlx_lm.server, thinking off, no JSON constraint" \
  --out out/eval/bench-round3b.md 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
PYTHONPATH=. uv run python ~/italia-diag/undercorrection.py work/eval/bench.jsonl \
  work/eval/bench-predictions.jsonl round2-handwritten round3-sft round3-dpo round3b-dpo \
  > ~/italia-diag/undercorrection-r3b.md 2>&1
step "done"
