#!/bin/zsh
# Ship check, part 4: higher-precision quants from the same bf16 GGUF + imatrix, served like the app
# (--reasoning-budget 0, json_schema grammar). Bench only (+ learner-v2), raw/snap.
set -u
cd ~/code/italia/training && source mac.local.sh
LOG=~/italia-diag/ship-pipeline.log
G=out/gguf-round12m
B=work/llama.cpp/build/bin
step() { echo "=== $(date "+%F %T") $*" | tee -a $LOG; }
for v in q4km:Q4_K_M q5km:Q5_K_M q8:Q8_0; do
  a=${v%%:*}; q=${v#*:}; f=$G/italia-tutor-e4b-$a-imat.gguf
  step "quantize $q"
  [[ -f $f ]] || $B/llama-quantize --imatrix $G/italia-tutor-e4b.imatrix $G/italia-tutor-e4b-bf16.gguf $f $q >> ~/italia-diag/ship-quant3.log 2>&1
  ls -l $f | tee -a $LOG; shasum -a 256 $f | tee -a $LOG
  $B/llama-server -m $f --port 8097 --alias $a -c 65536 -np 8 -ngl 99 --jinja --reasoning-budget 0 >> ~/italia-diag/serve-ship.log 2>&1 &
  for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8097/v1/models | grep -q "\"$a\"" && break; sleep 5; done
  uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/bench.jsonl \
    --out work/eval/bench-predictions.jsonl --system round12m-$a-rb0 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
  uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/learner-v2.jsonl \
    --out work/eval/learner-v2-predictions.jsonl --system round12m-$a-rb0 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
  pkill -f "llama-server -m"; sleep 3
done
S=(m12-k04 round12m-q4-rb0 round12m-q4km-rb0 round12m-q5km-rb0 round12m-q8-rb0 round12m-bf16-raw)
SA=(); for s in $S; do SA+=(--system $s); done
PYTHONPATH=. uv run python ~/italia-diag/undercorrection.py work/eval/bench.jsonl work/eval/bench-predictions.jsonl $S > ~/italia-diag/undercorrection-ship5.md 2>&1
W=~/code/italia/training/work/eval O=~/italia-diag/shipped
cd ~/italia-wt-main/training
for m in raw snap; do
  f=(); [[ $m != raw ]] && f=(--as-shipped $m)
  uv run python -m eval report -c datagen/configs/local-mac.yaml --no-languagetool --items $W/bench.jsonl \
    --predictions $W/bench-predictions.jsonl $SA $f --out $O/ship5-bench-$m.md 2>&1 | grep -v httpx | tail -1
  uv run python -m eval learner-report --items $W/learner-v2.jsonl --predictions $W/learner-v2-predictions.jsonl \
    $SA $f --out $O/ship5-learner-$m.md 2>&1 | tail -1
done
step "quants done"
