#!/bin/zsh
# Round 10, part 1: 4 samples at T=0.9 from round9m-b10 on 1,500 round-8 train turns; filter;
# judge-rank pairs (bench judge, both orders). Logs to ~/italia-diag/r10-pipeline.log.
set -u
cd ~/code/italia/training && source mac.local.sh
LOG=~/italia-diag/r10-pipeline.log
D=work/dpo-round10
step() { echo "=== $(date "+%F %T") $*" | tee -a $LOG; }
die() { step "FAILED: $*"; exit 1; }
pkill -f "mlx_lm.server" 2>/dev/null; pkill -f "datagen.serve_teacher" 2>/dev/null; sleep 3
step "sample round9m-b10 x4 at T=0.9 on $(wc -l < $D/subset.jsonl | tr -d " ") turns"
.venv/bin/mlx_lm.server --model out/merged/round9m-b10 --port 8096 --decode-concurrency 16 \
  --prompt-concurrency 4 >> ~/italia-diag/serve-r10.log 2>&1 &
ok=0; for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8096/v1/models | grep -q round9m-b10 && { ok=1; break; }; sleep 5; done
[[ $ok == 1 ]] || die "server did not start"
for s in r10-s1 r10-s2 r10-s3 r10-s4; do
  uv run python -m eval predict --systems $D/systems.yaml --items $D/subset.jsonl \
    --out $D/samples.jsonl --system $s 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
done
pkill -f "mlx_lm.server"; sleep 3
step "filter + judge-rank"
LOCAL_TEACHER_PORT=8081 caffeinate -dimsu scripts/serve-teacher.sh \
  mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit >> judge-server.log 2>&1 &
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8081/v1/models >/dev/null && break; sleep 5; done
export LOCAL_JUDGE_URL=http://127.0.0.1:8081/v1 LOCAL_JUDGE_MODEL=mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit
PYTHONPATH=. caffeinate -dimsu uv run python ~/italia-diag/r10_rank.py $D/subset.jsonl $D/samples.jsonl \
  $D/pairs.jsonl 2>&1 | grep -v httpx | tee -a $LOG
pkill -f "datagen.serve_teacher"
[[ -s $D/pairs.jsonl ]] || die "no pairs"
step "ranked"
