#!/bin/zsh
# Round 12: sample round11-dpo (4x on 1,500 fresh train turns and on 1,300 gold-none over turns,
# 2x on 1,061 r-miss turns); judge-rank reply pairs; mine over-correction pairs; r-miss
# gold-vs-sample; assemble (off-policy <= 25%); train via r12_train.sh. Log: ~/italia-diag/r12-pipeline.log.
set -u
cd ~/code/italia/training && source mac.local.sh
LOG=~/italia-diag/r12-pipeline.log
D=work/dpo-round12
step() { echo "=== $(date "+%F %T") $*" | tee -a $LOG; }
die() { step "FAILED: $*"; exit 1; }
pkill -f "mlx_lm.server" 2>/dev/null; pkill -f "datagen.serve_teacher" 2>/dev/null; sleep 3
step "sample round11-dpo: x4 on 1,500 train + 1,300 gold-none turns, x2 on 1,061 r-miss turns"
.venv/bin/mlx_lm.server --model out/merged/round11-dpo --port 8098 --decode-concurrency 16 \
  --prompt-concurrency 4 >> ~/italia-diag/serve-r12.log 2>&1 &
ok=0; for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8098/v1/models | grep -q round11-dpo && { ok=1; break; }; sleep 5; done
[[ $ok == 1 ]] || die "server did not start"
for s in r12-s1 r12-s2 r12-s3 r12-s4; do
  uv run python -m eval predict --systems $D/systems.yaml --items $D/subset.jsonl \
    --out $D/samples.jsonl --system $s 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
  uv run python -m eval predict --systems $D/systems.yaml --items $D/over-subset.jsonl \
    --out $D/over-samples.jsonl --system $s 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
done
for s in r12-s1 r12-s2; do
  uv run python -m eval predict --systems $D/systems.yaml --items $D/rmiss-items.jsonl \
    --out $D/rmiss-samples.jsonl --system $s 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
done
pkill -f "mlx_lm.server"; sleep 3
step "over-correction candidates (no judge)"
PYTHONPATH=. uv run python ~/italia-diag/r12_over.py $D/over-subset.jsonl $D/over-samples.jsonl $D/over-candidates.jsonl 2>&1 | grep -v httpx | tee -a $LOG
step "judge: rank train turns + r-miss gold-vs-sample"
LOCAL_TEACHER_PORT=8081 caffeinate -dimsu scripts/serve-teacher.sh \
  mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit >> judge-server.log 2>&1 &
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8081/v1/models >/dev/null && break; sleep 5; done
export LOCAL_JUDGE_URL=http://127.0.0.1:8081/v1 LOCAL_JUDGE_MODEL=mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit
PYTHONPATH=. caffeinate -dimsu uv run python ~/italia-diag/r12_rank.py $D/subset.jsonl $D/samples.jsonl \
  $D/ranked.jsonl 2>&1 | grep -v httpx | tee -a $LOG
PYTHONPATH=. caffeinate -dimsu uv run python ~/italia-diag/r12_rmiss.py $D/rmiss-items.jsonl $D/rmiss-samples.jsonl \
  $D/rmiss-pairs.jsonl 2>&1 | grep -v httpx | tee -a $LOG
pkill -f "datagen.serve_teacher"; sleep 3
step "assemble"
python3 ~/italia-diag/r12_assemble.py $D/ranked.jsonl $D/over-candidates.jsonl $D/rmiss-pairs.jsonl $D/pairs.jsonl 2>&1 | tee -a $LOG
n=$(wc -l < $D/pairs.jsonl | tr -d " ")
(( n >= 600 )) || die "only $n pairs"
step "start training: $n pairs"
~/italia-diag/r12_train.sh
