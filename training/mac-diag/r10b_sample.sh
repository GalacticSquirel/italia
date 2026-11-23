#!/bin/zsh
# Round 10b, part 1: 4 T=0.9 samples from round10-dpo on 1,998 fresh round-8 train turns and 2 on
# the 930 r-reply turns; judge-rank (same as round 10); r-reply gold-vs-sample; assemble with 300
# round-9 missed pairs; auto-start training if >= 600 pairs (pre-approved).
set -u
cd ~/code/italia/training && source mac.local.sh
LOG=~/italia-diag/r10b-pipeline.log
D=work/dpo-round10b
step() { echo "=== $(date "+%F %T") $*" | tee -a $LOG; }
die() { step "FAILED: $*"; exit 1; }
pkill -f "mlx_lm.server" 2>/dev/null; pkill -f "datagen.serve_teacher" 2>/dev/null; sleep 3
step "sample round10-dpo: x4 on $(wc -l < $D/subset.jsonl | tr -d " ") train turns, x2 on $(wc -l < $D/reply-items.jsonl | tr -d " ") r-reply turns"
.venv/bin/mlx_lm.server --model out/merged/round10-dpo --port 8099 --decode-concurrency 16 \
  --prompt-concurrency 4 >> ~/italia-diag/serve-r10b.log 2>&1 &
ok=0; for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8099/v1/models | grep -q round10-dpo && { ok=1; break; }; sleep 5; done
[[ $ok == 1 ]] || die "server did not start"
for s in r10b-s1 r10b-s2 r10b-s3 r10b-s4; do
  uv run python -m eval predict --systems $D/systems.yaml --items $D/subset.jsonl \
    --out $D/samples.jsonl --system $s 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
done
for s in r10b-s1 r10b-s2; do
  uv run python -m eval predict --systems $D/systems.yaml --items $D/reply-items.jsonl \
    --out $D/reply-samples.jsonl --system $s 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
done
pkill -f "mlx_lm.server"; sleep 3
step "judge: rank train turns + r-reply gold-vs-sample"
LOCAL_TEACHER_PORT=8081 caffeinate -dimsu scripts/serve-teacher.sh \
  mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit >> judge-server.log 2>&1 &
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8081/v1/models >/dev/null && break; sleep 5; done
export LOCAL_JUDGE_URL=http://127.0.0.1:8081/v1 LOCAL_JUDGE_MODEL=mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit
PYTHONPATH=. caffeinate -dimsu uv run python ~/italia-diag/r10b_rank.py $D/subset.jsonl $D/samples.jsonl \
  $D/ranked.jsonl 2>&1 | grep -v httpx | tee -a $LOG
PYTHONPATH=. caffeinate -dimsu uv run python ~/italia-diag/r10b_reply.py $D/reply-items.jsonl $D/reply-samples.jsonl \
  $D/reply-pairs.jsonl 2>&1 | grep -v httpx | tee -a $LOG
pkill -f "datagen.serve_teacher"; sleep 3
step "assemble"
python3 ~/italia-diag/r10b_assemble.py $D/ranked.jsonl work/dpo-round9/pairs.jsonl $D/reply-pairs.jsonl \
  $D/pairs.jsonl 2>&1 | tee -a $LOG
n=$(wc -l < $D/pairs.jsonl | tr -d " ")
if (( n >= 600 )); then
  step "auto-start: $n pairs"
  ~/italia-diag/r10b_train.sh
else
  step "STOP: only $n pairs (pre-approval needs >= 600)"
fi
