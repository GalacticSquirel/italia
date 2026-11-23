#!/bin/zsh
# Round 11, part 1: wrap round10m as a full delta; 4 T=0.9 samples on 1,500 fresh round-8 train
# turns and 2 on the 549 r-clue-answer turns; judge-rank (as round 10); r-clue gold-vs-sample;
# ~100 on-policy missed pairs; assemble; then r11_train.sh. Logs to ~/italia-diag/r11-pipeline.log.
set -u
cd ~/code/italia/training && source mac.local.sh
LOG=~/italia-diag/r11-pipeline.log
D=work/dpo-round11
step() { echo "=== $(date "+%F %T") $*" | tee -a $LOG; }
die() { step "FAILED: $*"; exit 1; }
pkill -f "mlx_lm.server" 2>/dev/null; pkill -f "datagen.serve_teacher" 2>/dev/null; sleep 3
step "wrap round10m as a full delta"
[[ -f out/mlx/round10m/final/weights.safetensors ]] || PYTHONPATH=. uv run --extra mlx python ~/italia-diag/full_delta.py \
  out/merged/round10m out/mlx/round10m/final 2>&1 | grep -v Warning | tail -2 | tee -a $LOG
grep -q "round-trip check: \([0-9]*\)/\1" $LOG || die "round-trip check failed"
step "sample round10m: x4 on $(wc -l < $D/subset.jsonl | tr -d " ") train turns, x2 on $(wc -l < $D/clue-items.jsonl | tr -d " ") r-clue turns"
.venv/bin/mlx_lm.server --model out/merged/round10m --port 8096 --decode-concurrency 16 \
  --prompt-concurrency 4 >> ~/italia-diag/serve-r11.log 2>&1 &
ok=0; for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8096/v1/models | grep -q round10m && { ok=1; break; }; sleep 5; done
[[ $ok == 1 ]] || die "server did not start"
for s in r11-s1 r11-s2 r11-s3 r11-s4; do
  uv run python -m eval predict --systems $D/systems.yaml --items $D/subset.jsonl \
    --out $D/samples.jsonl --system $s 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
done
for s in r11-s1 r11-s2; do
  uv run python -m eval predict --systems $D/systems.yaml --items $D/clue-items.jsonl \
    --out $D/clue-samples.jsonl --system $s 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
done
pkill -f "mlx_lm.server"; sleep 3
step "missed-correction pairs (no judge)"
PYTHONPATH=. uv run python ~/italia-diag/r11_missed.py $D/subset.jsonl $D/samples.jsonl $D/missed.jsonl 2>&1 | grep -v httpx | tee -a $LOG
step "judge: rank train turns + r-clue gold-vs-sample"
LOCAL_TEACHER_PORT=8081 caffeinate -dimsu scripts/serve-teacher.sh \
  mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit >> judge-server.log 2>&1 &
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8081/v1/models >/dev/null && break; sleep 5; done
export LOCAL_JUDGE_URL=http://127.0.0.1:8081/v1 LOCAL_JUDGE_MODEL=mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit
PYTHONPATH=. caffeinate -dimsu uv run python ~/italia-diag/r11_rank.py $D/subset.jsonl $D/samples.jsonl \
  $D/ranked.jsonl 2>&1 | grep -v httpx | tee -a $LOG
PYTHONPATH=. caffeinate -dimsu uv run python ~/italia-diag/r11_clue.py $D/clue-items.jsonl $D/clue-samples.jsonl \
  $D/clue-pairs.jsonl 2>&1 | grep -v httpx | tee -a $LOG
pkill -f "datagen.serve_teacher"; sleep 3
step "assemble"
python3 ~/italia-diag/r11_assemble.py $D/ranked.jsonl $D/missed.jsonl $D/clue-pairs.jsonl $D/pairs.jsonl 2>&1 | tee -a $LOG
n=$(wc -l < $D/pairs.jsonl | tr -d " ")
(( n >= 400 )) || die "only $n pairs"
step "start training: $n pairs"
~/italia-diag/r11_train.sh
