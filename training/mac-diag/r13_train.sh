#!/bin/zsh
# Round 9, part 2: DPO on the round8-sft adapter (beta 0.05, NLL on chosen 1.0, LR 5e-6 cosine,
# 1 epoch, LoRA r64), fuse, bench + learner-v2, judged report (pairwise vs reference and
# round8-sft), then raw/strict/snap re-scores in ~/italia-wt-main. Logs to ~/italia-diag/r13-pipeline.log.
set -u
cd ~/code/italia/training && source mac.local.sh
LOG=~/italia-diag/r13-pipeline.log
D=work/dpo-round13
step() { echo "=== $(date '+%F %T') $*" | tee -a $LOG; }
die() { step "FAILED: $*"; exit 1; }
pkill -f "mlx_lm.server" 2>/dev/null; pkill -f "datagen.serve_teacher" 2>/dev/null; sleep 3

step "DPO round13 on round12m ($(wc -l < $D/pairs.jsonl | tr -d ' ') pairs)"
if [[ ! -f out/mlx/round13-dpo/final/weights.safetensors ]]; then
  caffeinate -dimsu uv run --extra mlx python -m train.dpo -c train/configs/mlx/dpo-gemma4-e4b.yaml \
    --set policyModel=out/mlx/round12m/final --set pairsFile=$D/pairs.jsonl \
    --set beta=0.05 --set sftLossWeight=1.0 --set optim.learningRate=5.0e-6 \
    --set optim.lrScheduler=cosine --set optim.epochs=1 --set lora.r=64 --set lora.alpha=64 \
    --set valFraction=0.05 --set outputDir=out/mlx/round13-dpo >> ~/italia-diag/dpo-round13.log 2>&1 \
    || die "DPO failed (see dpo-round13.log)"
fi
grep -E "validation" ~/italia-diag/dpo-round13.log | tail -1 | tee -a $LOG

step "fuse round13-dpo"
[[ -f out/merged/round13-dpo/model.safetensors ]] || \
  uv run --extra mlx python -m export mlx-fuse --model out/mlx/round13-dpo/final \
    --out out/merged/round13-dpo 2>&1 | tail -1 | tee -a $LOG
[[ -f out/merged/round13-dpo/model.safetensors ]] || die "fuse failed"

step "predict round13-dpo: bench + learner-v2"
.venv/bin/mlx_lm.server --model out/merged/round13-dpo --port 8099 --decode-concurrency 16 \
  --prompt-concurrency 4 >> ~/italia-diag/serve-r9.log 2>&1 &
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8099/v1/models | grep -q round13-dpo && break; sleep 5; done
uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/bench.jsonl \
  --out work/eval/bench-predictions.jsonl --system round13-dpo 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/learner-v2.jsonl \
  --out work/eval/learner-v2-predictions.jsonl --system round13-dpo 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
pkill -f "mlx_lm.server"; sleep 3
step "predicted"

step "judge + report"
LOCAL_TEACHER_PORT=8081 caffeinate -dimsu scripts/serve-teacher.sh \
  mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit >> judge-server.log 2>&1 &
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8081/v1/models >/dev/null && break; sleep 5; done
export LOCAL_JUDGE_URL=http://127.0.0.1:8081/v1 LOCAL_JUDGE_MODEL=mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit
uv run python -m eval report -c datagen/configs/local-mac.yaml --items work/eval/bench.jsonl \
  --predictions work/eval/bench-predictions.jsonl \
  --system m12-k04 --system round12-dpo --system round13-dpo \
  --pairwise round13-dpo:teacher-reference --pairwise round13-dpo:m12-k04 \
  --title "Round 13: DPO on round12m (calque, morph, cui-di, multi-target, echo) (801 items)" \
  --note "round13-dpo = DPO on round12m (merged, wrapped as a full delta; fresh LoRA r64): judge-ranked on-policy reply pairs + ~120 on-policy over-correction pairs + r-calque/r-morph-late/r-cui-di/r-multi-target gold-vs-sample pairs + echo/affirm negatives, off-policy <= 30%, beta 0.05, NLL 1.0, LR 5e-6 cosine, 1 epoch" \
  --out out/eval/bench-round13.md 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
pkill -f "datagen.serve_teacher"
PYTHONPATH=. uv run python ~/italia-diag/undercorrection.py work/eval/bench.jsonl \
  work/eval/bench-predictions.jsonl m12-k04 round12-dpo round13-dpo \
  > ~/italia-diag/undercorrection-r13.md 2>&1
PYTHONPATH=. uv run python ~/italia-diag/overcorrect.py round13-dpo m12-k04 \
  > ~/italia-diag/round13-dpo-overcorrect.jsonl 2>&1

step "as-shipped re-scores (raw, strict, snap)"
W=~/code/italia/training/work/eval O=~/italia-diag/shipped
cd ~/italia-wt-main/training
for m in raw strict snap; do
  f=(); [[ $m != raw ]] && f=(--as-shipped $m)
  uv run python -m eval report -c datagen/configs/local-mac.yaml --no-languagetool \
    --items $W/bench.jsonl --predictions $W/bench-predictions.jsonl \
    --system m12-k04 --system round12-dpo --system round13-dpo $f --out $O/r13-bench-$m.md 2>&1 | grep -v httpx | tail -1
  uv run python -m eval learner-report --items $W/learner-v2.jsonl \
    --predictions $W/learner-v2-predictions.jsonl --system m12-k04 --system round12-dpo --system round13-dpo $f \
    --out $O/r13-learner-$m.md 2>&1 | tail -1
done
step "done"
