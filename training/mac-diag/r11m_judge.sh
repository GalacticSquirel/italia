#!/bin/zsh
set -u
cd ~/code/italia/training && source mac.local.sh
LOG=~/italia-diag/r11m-pipeline.log
step() { echo "=== $(date "+%F %T") $*" | tee -a $LOG; }
curl -s -m 3 http://127.0.0.1:8081/v1/models >/dev/null || { LOCAL_TEACHER_PORT=8081 caffeinate -dimsu scripts/serve-teacher.sh \
  mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit >> judge-server.log 2>&1 & }
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8081/v1/models >/dev/null && break; sleep 5; done
export LOCAL_JUDGE_URL=http://127.0.0.1:8081/v1 LOCAL_JUDGE_MODEL=mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit
for n in m11-k04; do
  step "judge ${n}"
  uv run python -m eval report -c datagen/configs/local-mac.yaml --items work/eval/bench.jsonl \
    --predictions work/eval/bench-predictions.jsonl --system m10-k04 --system round11-dpo --system "${n}" \
    --pairwise "${n}:teacher-reference" --pairwise "${n}:m10-k04" \
    --title "Round 11m, ${n} (801 items)" \
    --note "${n} = W10m + 0.4 (W11 - W10m), exact float32 merge of fused round10m and round11-dpo" \
    --out "out/eval/bench-r11m-${n}.md" 2>&1 | grep -v httpx | tail -3 | tee -a $LOG
  grep -E "^\| ${n} \| (teacher-reference|m10-k04) " "out/eval/bench-r11m-${n}.md" | tee -a $LOG
done
pkill -f "datagen.serve_teacher"
step "judged"
