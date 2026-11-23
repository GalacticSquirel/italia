#!/bin/zsh
# Round 13: wrap round12m; sample it (4x on 1,496 train + 1,200 gold-none, 2x on 1,880 new-set turns);
# over + echo mining (no judge); judge-rank + new-set gold-vs-sample; assemble (off-policy <= 30%);
# train via r13_train.sh. Log: ~/italia-diag/r13-pipeline.log.
set -u
cd ~/code/italia/training && source mac.local.sh
LOG=~/italia-diag/r13-pipeline.log
D=work/dpo-round13
step() { echo "=== $(date "+%F %T") $*" | tee -a $LOG; }
die() { step "FAILED: $*"; exit 1; }
pkill -f "mlx_lm.server" 2>/dev/null; pkill -f "datagen.serve_teacher" 2>/dev/null; pkill -f "llama-server -m" 2>/dev/null; sleep 3
step "wrap round12m as a full delta"
[[ -f out/mlx/round12m/final/weights.safetensors ]] || PYTHONPATH=. uv run --extra mlx python ~/italia-diag/full_delta.py \
  out/merged/round12m out/mlx/round12m/final 2>&1 | grep -v Warning | tail -2 | tee -a $LOG
grep -q "round-trip check: \([0-9]*\)/\1" $LOG || die "round-trip check failed"
step "sample round12m"
.venv/bin/mlx_lm.server --model out/merged/round12m --port 8096 --decode-concurrency 16 \
  --prompt-concurrency 4 >> ~/italia-diag/serve-r13.log 2>&1 &
ok=0; for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8096/v1/models | grep -q round12m && { ok=1; break; }; sleep 5; done
[[ $ok == 1 ]] || die "server did not start"
for s in r13-s1 r13-s2 r13-s3 r13-s4; do
  uv run python -m eval predict --systems $D/systems.yaml --items $D/subset.jsonl --out $D/samples.jsonl --system $s 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
  uv run python -m eval predict --systems $D/systems.yaml --items $D/over-subset.jsonl --out $D/over-samples.jsonl --system $s 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
done
for s in r13-s1 r13-s2; do
  uv run python -m eval predict --systems $D/systems.yaml --items $D/newset-items.jsonl --out $D/newset-samples.jsonl --system $s 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
done
pkill -f "mlx_lm.server"; sleep 3
step "over + echo mining (no judge)"
PYTHONPATH=. uv run python ~/italia-diag/r13_over.py $D/over-subset.jsonl $D/over-samples.jsonl $D/over-candidates.jsonl 2>&1 | grep -v httpx | tee -a $LOG
PYTHONPATH=. uv run python ~/italia-diag/r13_echo.py $D/subset.jsonl $D/samples.jsonl $D/echo.jsonl 2>&1 | grep -v httpx | tee -a $LOG
step "judge: rank + new-set gold-vs-sample"
LOCAL_TEACHER_PORT=8081 caffeinate -dimsu scripts/serve-teacher.sh mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit >> judge-server.log 2>&1 &
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8081/v1/models >/dev/null && break; sleep 5; done
export LOCAL_JUDGE_URL=http://127.0.0.1:8081/v1 LOCAL_JUDGE_MODEL=mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit
PYTHONPATH=. caffeinate -dimsu uv run python ~/italia-diag/r13_rank.py $D/subset.jsonl $D/samples.jsonl $D/ranked.jsonl 2>&1 | grep -v httpx | tee -a $LOG
PYTHONPATH=. caffeinate -dimsu uv run python ~/italia-diag/r13_newsets.py $D/newset-items.jsonl $D/newset-samples.jsonl $D/newset-pairs.jsonl 2>&1 | grep -v httpx | tee -a $LOG
pkill -f "datagen.serve_teacher"; sleep 3
step "assemble"
python3 ~/italia-diag/r13_assemble.py $D/ranked.jsonl $D/over-candidates.jsonl $D/newset-pairs.jsonl $D/echo.jsonl $D/pairs.jsonl 2>&1 | tee -a $LOG
n=$(wc -l < $D/pairs.jsonl | tr -d " ")
(( n >= 600 )) || die "only $n pairs"
step "start training: $n pairs"
~/italia-diag/r13_train.sh
