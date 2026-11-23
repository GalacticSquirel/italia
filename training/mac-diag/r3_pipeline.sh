#!/bin/zsh
# Round 3 after SFT: on-policy DPO pairs from round3-sft, DPO, then benchmark round 2 vs
# round3-sft vs round3-dpo. Every step logs to ~/italia-diag/r3-pipeline.log; steps whose
# output already exists are skipped, so the script can be rerun after an interruption.
set -u
cd ~/code/italia/training && source mac.local.sh
export TARGET_DIALOGUES=10000
LOG=~/italia-diag/r3-pipeline.log
D=work/dpo-round3-sft
step() { echo "=== $(date '+%F %T') $*" | tee -a $LOG; }
die() { step "FAILED: $*"; exit 1; }

serve() {  # serve <model dir> <port>
  pkill -f "mlx_lm.server" 2>/dev/null; sleep 3
  .venv/bin/mlx_lm.server --model "$1" --port "$2" --decode-concurrency 16 --prompt-concurrency 4 \
    >> ~/italia-diag/serve-r3.log 2>&1 &
  for i in $(seq 1 60); do curl -s -m 3 "http://127.0.0.1:$2/v1/models" >/dev/null && return 0; sleep 5; done
  die "server for $1 did not start"
}
predict() {  # predict <system> <items> <out>
  uv run python -m eval predict --systems work/eval/systems-mac.yaml --items "$2" --out "$3" \
    --system "$1" 2>&1 | grep -v httpx | tail -2 | tee -a $LOG
}

step "waiting for round3-sft"
until [[ -f out/mlx/round3-sft/final/weights.safetensors ]]; do
  grep -q Traceback sft-round3.log && die "round3-sft training crashed (see sft-round3.log)"
  sleep 60
done
grep "step 400 validation" sft-round3.log | tail -1 | tee -a $LOG

step "fuse round3-sft"
[[ -f out/merged/round3-sft/model.safetensors ]] || \
  uv run --extra mlx python -m export mlx-fuse --model out/mlx/round3-sft/final \
    --out out/merged/round3-sft 2>&1 | tail -1 | tee -a $LOG

step "predict round3-sft: train items and bench"
serve out/merged/round3-sft 8085
predict round3-sft $D/items.jsonl $D/predictions.jsonl
predict round3-sft work/eval/bench.jsonl work/eval/bench-predictions.jsonl
pkill -f "mlx_lm.server"; sleep 3

step "pairs"
PYTHONPATH=. uv run python ~/italia-diag/r3_pairs.py $D/items.jsonl $D/predictions.jsonl \
  round3-sft $D/pairs.jsonl 2>&1 | tee -a $LOG
[[ -s $D/pairs.jsonl ]] || die "no pairs"

step "DPO on round3-sft"
if [[ ! -f out/mlx/round3-dpo/final/weights.safetensors ]]; then
  caffeinate -dimsu uv run --extra mlx python -m train.dpo -c train/configs/mlx/dpo-gemma4-e4b.yaml \
    --set policyModel=out/mlx/round3-sft/final --set pairsFile=$D/pairs.jsonl \
    --set outputDir=out/mlx/round3-dpo >> ~/italia-diag/dpo-round3.log 2>&1 \
    || die "DPO failed (see dpo-round3.log)"
fi
grep -E "validation|saved" ~/italia-diag/dpo-round3.log | tail -2 | tee -a $LOG

step "fuse round3-dpo"
[[ -f out/merged/round3-dpo/model.safetensors ]] || \
  uv run --extra mlx python -m export mlx-fuse --model out/mlx/round3-dpo/final \
    --out out/merged/round3-dpo 2>&1 | tail -1 | tee -a $LOG

step "predict round3-dpo: bench"
serve out/merged/round3-dpo 8086
predict round3-dpo work/eval/bench.jsonl work/eval/bench-predictions.jsonl
pkill -f "mlx_lm.server"; sleep 3

step "judge + report"
LOCAL_TEACHER_PORT=8081 caffeinate -dimsu scripts/serve-teacher.sh \
  mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit >> judge-server.log 2>&1 &
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8081/v1/models >/dev/null && break; sleep 5; done
export LOCAL_JUDGE_URL=http://127.0.0.1:8081/v1 LOCAL_JUDGE_MODEL=mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit
uv run python -m eval report -c datagen/configs/local-mac.yaml --items work/eval/bench.jsonl \
  --predictions work/eval/bench-predictions.jsonl \
  --system round2-handwritten --system round3-sft --system round3-dpo \
  --pairwise round2-handwritten:teacher-reference --pairwise round3-sft:teacher-reference \
  --pairwise round3-dpo:teacher-reference \
  --title "Round 3: SFT on everything, then on-policy DPO, vs round 2 (801 items)" \
  --note "round2-handwritten = LoRA SFT on 2,644; round3-sft = LoRA SFT from base on 3,197 (round 1 + 2,370 hand-written incl. y-*); round3-dpo = on-policy DPO on round3-sft (gold chosen, own turn rejected, weak areas x2); mlx_lm.server, thinking off, no JSON constraint" \
  --out out/eval/bench-round3.md 2>&1 | grep -v httpx | tail -2 | tee -a $LOG
PYTHONPATH=. uv run python ~/italia-diag/undercorrection.py work/eval/bench.jsonl \
  work/eval/bench-predictions.jsonl base round1-baseline round2-handwritten round3-sft round3-dpo \
  > ~/italia-diag/undercorrection-r3.md 2>&1
step "done"
