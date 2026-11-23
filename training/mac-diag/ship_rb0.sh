#!/bin/zsh
# Ship check, part 2: (1) our Q4_0 (default llama-quantize types) served with --reasoning-budget 0,
# constrained; (2) a stock-matching quant (token_embd Q8_0, per_layer_token_embd Q4_0, ffn_down Q4_0),
# same serving. Bench + learner-v2, raw/snap vs float.
set -u
cd ~/code/italia/training && source mac.local.sh
LOG=~/italia-diag/ship-pipeline.log
G=out/gguf-round12m
step() { echo "=== $(date "+%F %T") $*" | tee -a $LOG; }
die() { step "FAILED: $*"; exit 1; }
run() {  # run <gguf> <alias> <system>
  work/llama.cpp/build/bin/llama-server -m $1 --port 8097 --alias $2 -c 65536 -np 8 -ngl 99 --jinja --reasoning-budget 0 \
    >> ~/italia-diag/serve-ship.log 2>&1 &
  ok=0; for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8097/v1/models | grep -q "\"$2\"" && { ok=1; break; }; sleep 5; done
  [[ $ok == 1 ]] || die "server $2 did not start"
  uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/bench.jsonl \
    --out work/eval/bench-predictions.jsonl --system $3 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
  uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/learner-v2.jsonl \
    --out work/eval/learner-v2-predictions.jsonl --system $3 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
  pkill -f "llama-server -m"; sleep 3
}
step "Q4_0 (ours) with --reasoning-budget 0"
run $G/italia-tutor-e4b-q4_0-imat.gguf q4 round12m-q4-rb0
step "stock-matching quant"
[[ -f $G/italia-tutor-e4b-q4_0-imat-stocktypes.gguf ]] || work/llama.cpp/build/bin/llama-quantize --imatrix $G/italia-tutor-e4b.imatrix \
  --token-embedding-type q8_0 --tensor-type per_layer_token_embd=q4_0 --tensor-type ffn_down=q4_0 \
  $G/italia-tutor-e4b-bf16.gguf $G/italia-tutor-e4b-q4_0-imat-stocktypes.gguf Q4_0 >> ~/italia-diag/ship-quant2.log 2>&1 || die "quantize failed"
ls -l $G/italia-tutor-e4b-q4_0-imat-stocktypes.gguf | tee -a $LOG
shasum -a 256 $G/italia-tutor-e4b-q4_0-imat-stocktypes.gguf | tee -a $LOG
run $G/italia-tutor-e4b-q4_0-imat-stocktypes.gguf q4s round12m-q4s-rb0
step "score"
PYTHONPATH=. uv run python ~/italia-diag/undercorrection.py work/eval/bench.jsonl work/eval/bench-predictions.jsonl \
  m12-k04 round12m-q4-rb0 round12m-q4s-rb0 > ~/italia-diag/undercorrection-ship.md 2>&1
W=~/code/italia/training/work/eval O=~/italia-diag/shipped
cd ~/italia-wt-main/training
for m in raw snap; do
  f=(); [[ $m != raw ]] && f=(--as-shipped $m)
  uv run python -m eval report -c datagen/configs/local-mac.yaml \
    --items $W/bench.jsonl --predictions $W/bench-predictions.jsonl --system m12-k04 --system round12m-q4-rb0 --system round12m-q4s-rb0 $f \
    --out $O/ship3-bench-$m.md 2>&1 | grep -v httpx | tail -1
  uv run python -m eval learner-report --items $W/learner-v2.jsonl --predictions $W/learner-v2-predictions.jsonl \
    --system m12-k04 --system round12m-q4-rb0 --system round12m-q4s-rb0 $f --out $O/ship3-learner-$m.md 2>&1 | tail -1
done
step "rb0 done"
