#!/bin/zsh
# Round 9, part 1: sample round8-sft 4x at temperature 0.8 on the ~2,500-turn train subset,
# then mine balanced DPO pairs. Logs to ~/italia-diag/r9-pipeline.log.
set -u
cd ~/code/italia/training && source mac.local.sh
LOG=~/italia-diag/r9-pipeline.log
D=work/dpo-round9
step() { echo "=== $(date '+%F %T') $*" | tee -a $LOG; }
die() { step "FAILED: $*"; exit 1; }
pkill -f "mlx_lm.server" 2>/dev/null; sleep 3

step "sample round8-sft x4 at T=0.8 on $(wc -l < $D/subset.jsonl | tr -d ' ') turns"
.venv/bin/mlx_lm.server --model out/merged/round8-sft --port 8093 --decode-concurrency 16 \
  --prompt-concurrency 4 >> ~/italia-diag/serve-r9.log 2>&1 &
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8093/v1/models >/dev/null && break; sleep 5; done
for s in r9-s1 r9-s2 r9-s3 r9-s4; do
  uv run python -m eval predict --systems $D/systems.yaml --items $D/subset.jsonl \
    --out $D/samples.jsonl --system $s 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
done
pkill -f "mlx_lm.server"; sleep 3

step "mine + balance pairs"
PYTHONPATH=. uv run python ~/italia-diag/r9_pairs.py $D/subset.jsonl $D/samples.jsonl \
  $D/pairs.jsonl 2>&1 | grep -v httpx | tee -a $LOG
[[ -s $D/pairs.jsonl ]] || die "no pairs"
step "sampled"
