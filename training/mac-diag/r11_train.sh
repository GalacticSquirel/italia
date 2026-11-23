#!/bin/zsh
# Round 9, part 2: DPO on the round8-sft adapter (beta 0.05, NLL on chosen 1.0, LR 5e-6 cosine,
# 1 epoch, LoRA r64), fuse, bench + learner-v2, judged report (pairwise vs reference and
# round8-sft), then raw/strict/snap re-scores in ~/italia-wt-main. Logs to ~/italia-diag/r11-pipeline.log.
set -u
cd ~/code/italia/training && source mac.local.sh
LOG=~/italia-diag/r11-pipeline.log
D=work/dpo-round11
step() { echo "=== $(date '+%F %T') $*" | tee -a $LOG; }
die() { step "FAILED: $*"; exit 1; }
pkill -f "mlx_lm.server" 2>/dev/null; pkill -f "datagen.serve_teacher" 2>/dev/null; sleep 3

step "DPO round11 on round10m ($(wc -l < $D/pairs.jsonl | tr -d ' ') pairs)"
if [[ ! -f out/mlx/round11-dpo/final/weights.safetensors ]]; then
  caffeinate -dimsu uv run --extra mlx python -m train.dpo -c train/configs/mlx/dpo-gemma4-e4b.yaml \
    --set policyModel=out/mlx/round10m/final --set pairsFile=$D/pairs.jsonl \
    --set beta=0.05 --set sftLossWeight=1.0 --set optim.learningRate=5.0e-6 \
    --set optim.lrScheduler=cosine --set optim.epochs=1 --set lora.r=64 --set lora.alpha=64 \
    --set valFraction=0.05 --set outputDir=out/mlx/round11-dpo >> ~/italia-diag/dpo-round11.log 2>&1 \
    || die "DPO failed (see dpo-round11.log)"
fi
grep -E "validation" ~/italia-diag/dpo-round11.log | tail -1 | tee -a $LOG

step "fuse round11-dpo"
[[ -f out/merged/round11-dpo/model.safetensors ]] || \
  uv run --extra mlx python -m export mlx-fuse --model out/mlx/round11-dpo/final \
    --out out/merged/round11-dpo 2>&1 | tail -1 | tee -a $LOG
[[ -f out/merged/round11-dpo/model.safetensors ]] || die "fuse failed"

step "predict round11-dpo: bench + learner-v2"
.venv/bin/mlx_lm.server --model out/merged/round11-dpo --port 8098 --decode-concurrency 16 \
  --prompt-concurrency 4 >> ~/italia-diag/serve-r9.log 2>&1 &
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8098/v1/models | grep -q round11-dpo && break; sleep 5; done
uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/bench.jsonl \
  --out work/eval/bench-predictions.jsonl --system round11-dpo 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/learner-v2.jsonl \
  --out work/eval/learner-v2-predictions.jsonl --system round11-dpo 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
pkill -f "mlx_lm.server"; sleep 3
step "predicted"

step "judge + report"
LOCAL_TEACHER_PORT=8081 caffeinate -dimsu scripts/serve-teacher.sh \
  mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit >> judge-server.log 2>&1 &
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8081/v1/models >/dev/null && break; sleep 5; done
export LOCAL_JUDGE_URL=http://127.0.0.1:8081/v1 LOCAL_JUDGE_MODEL=mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit
uv run python -m eval report -c datagen/configs/local-mac.yaml --items work/eval/bench.jsonl \
  --predictions work/eval/bench-predictions.jsonl \
  --system round10-dpo --system m10-k04 --system round11-dpo \
  --pairwise round11-dpo:teacher-reference --pairwise round11-dpo:m10-k04 \
  --title "Round 11: reply-quality DPO on round10m (801 items)" \
  --note "round11-dpo = DPO on round10m (merged, wrapped as a full delta; fresh LoRA r64): judge-ranked on-policy reply pairs from 4 T=0.9 samples on 1,500 fresh round-8 train turns + ~100 on-policy missed-correction pairs + r-clue-answer gold-vs-sample pairs, beta 0.05, NLL 1.0, LR 5e-6 cosine, 1 epoch" \
  --out out/eval/bench-round11.md 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
pkill -f "datagen.serve_teacher"
PYTHONPATH=. uv run python ~/italia-diag/undercorrection.py work/eval/bench.jsonl \
  work/eval/bench-predictions.jsonl round10-dpo m10-k04 round11-dpo \
  > ~/italia-diag/undercorrection-r11.md 2>&1
PYTHONPATH=. uv run python ~/italia-diag/overcorrect.py round11-dpo m10-k04 \
  > ~/italia-diag/round11-dpo-overcorrect.jsonl 2>&1

step "as-shipped re-scores (raw, strict, snap)"
W=~/code/italia/training/work/eval O=~/italia-diag/shipped
cd ~/italia-wt-main/training
for m in raw strict snap; do
  f=(); [[ $m != raw ]] && f=(--as-shipped $m)
  uv run python -m eval report -c datagen/configs/local-mac.yaml --no-languagetool \
    --items $W/bench.jsonl --predictions $W/bench-predictions.jsonl \
    --system round10-dpo --system m10-k04 --system round11-dpo $f --out $O/r11-bench-$m.md 2>&1 | grep -v httpx | tail -1
  uv run python -m eval learner-report --items $W/learner-v2.jsonl \
    --predictions $W/learner-v2-predictions.jsonl --system round10-dpo --system m10-k04 --system round11-dpo $f \
    --out $O/r11-learner-$m.md 2>&1 | tail -1
done
step "done"
