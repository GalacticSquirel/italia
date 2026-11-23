#!/bin/zsh
set -u
cd ~/code/italia/training && source mac.local.sh
LOG=~/italia-diag/r9m-pipeline.log
step() { echo "=== $(date "+%F %T") $*" | tee -a $LOG; }
step "judge round9m-b10 (= m-a05-b10)"
LOCAL_TEACHER_PORT=8081 caffeinate -dimsu scripts/serve-teacher.sh \
  mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit >> judge-server.log 2>&1 &
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8081/v1/models >/dev/null && break; sleep 5; done
export LOCAL_JUDGE_URL=http://127.0.0.1:8081/v1 LOCAL_JUDGE_MODEL=mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit
uv run python -m eval report -c datagen/configs/local-mac.yaml --items work/eval/bench.jsonl \
  --predictions work/eval/bench-predictions.jsonl --system round8-sft --system round9c-dpo --system m-a05-b10 \
  --pairwise m-a05-b10:teacher-reference --pairwise m-a05-b10:round8-sft \
  --title "Round 9m: two-delta merge W8 + 0.5 (W9 - W8) + 1.0 (W9c - W8) (801 items)" \
  --note "m-a05-b10 = round9m-b10: fused round8-sft + 0.5 x (round9-dpo - round8-sft) + 1.0 x (round9c-dpo - round8-sft), exact float32 merge; fused at out/merged/round9m-b10" \
  --out out/eval/bench-round9m-b10.md 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
pkill -f "datagen.serve_teacher"
step "judged"
