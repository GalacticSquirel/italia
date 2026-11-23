#!/bin/zsh
set -u
cd ~/code/italia/training && source mac.local.sh
LOG=~/italia-diag/qat-pipeline.log
step() { echo "=== $(date "+%F %T") $*" | tee -a $LOG; }
curl -s -m 3 http://127.0.0.1:8081/v1/models >/dev/null || { LOCAL_TEACHER_PORT=8081 caffeinate -dimsu scripts/serve-teacher.sh \
  mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit >> judge-server.log 2>&1 & }
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8081/v1/models >/dev/null && break; sleep 5; done
export LOCAL_JUDGE_URL=http://127.0.0.1:8081/v1 LOCAL_JUDGE_MODEL=mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit
for n in round12m-qat-q4; do
  step "judge ${n}"
  uv run python -m eval report -c datagen/configs/local-mac.yaml --items work/eval/bench.jsonl \
    --predictions work/eval/bench-predictions.jsonl --system m12-k04 --system "${n}" \
    --pairwise "${n}:teacher-reference" --pairwise "${n}:m12-k04" \
    --title "QAT, ${n} (801 items)" \
    --note "${n} = round12m QAT (exact Q4_0 fake-quant self-distillation), Q4_0 stock types no imatrix, llama-server b11804 --reasoning-budget 0 + json_schema" \
    --out "out/eval/bench-qat-${n}.md" 2>&1 | grep -v httpx | tail -3 | tee -a $LOG
  grep -E "^\| ${n} \| (teacher-reference|m12-k04) " "out/eval/bench-qat-${n}.md" | tee -a $LOG
done
pkill -f "datagen.serve_teacher"
step "judged"
