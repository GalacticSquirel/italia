#!/bin/zsh
set -u
cd ~/code/italia/training && source mac.local.sh
LOG=~/italia-diag/mx2judge.log
step() { echo "=== $(date "+%F %T") $*" | tee -a $LOG; }
pkill -f "mlx_lm.server" 2>/dev/null; pkill -f "llama-server -m" 2>/dev/null; sleep 3
step "over-correction diagnostic mx2 vs float round12m"
PYTHONPATH=. uv run python ~/italia-diag/overcorr.py work/eval/bench.jsonl work/eval/bench-predictions.jsonl qat2-e2-mx2 m12-k04 > ~/italia-diag/mx2-overcorr.txt 2>&1
head -3 ~/italia-diag/mx2-overcorr.txt | tee -a $LOG
step "judge mx2 (vs reference, pairwise vs QAT-2 e2 plain Q4_0)"
LOCAL_TEACHER_PORT=8081 caffeinate -dimsu scripts/serve-teacher.sh mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit >> judge-server.log 2>&1 &
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8081/v1/models >/dev/null && break; sleep 5; done
LOCAL_JUDGE_URL=http://127.0.0.1:8081/v1 LOCAL_JUDGE_MODEL=mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit \
  uv run python -m eval report -c datagen/configs/local-mac.yaml --items work/eval/bench.jsonl \
  --predictions work/eval/bench-predictions.jsonl --system m12-k04 --system round12m-qat2-e2-q4 --system qat2-e2-mx2 \
  --pairwise "qat2-e2-mx2:teacher-reference" --pairwise "qat2-e2-mx2:round12m-qat2-e2-q4" \
  --title "QAT-2 e2 mixed precision mx2 (ffn_down/attn_output Q6_K, token_embd Q4_0), no imatrix (801 items)" \
  --note "app path: llama-server b11804 --reasoning-budget 0 + json_schema" \
  --out out/eval/bench-mx2.md 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
grep -E "^\| qat2-e2-mx2 \| (teacher-reference|round12m-qat2-e2-q4) " out/eval/bench-mx2.md | tee -a $LOG
pkill -f "datagen.serve_teacher"
step "mx2 judge done"
