#!/bin/zsh
# Ship check, part 3: separate quantization loss from the "<|channel>thought<channel|>" prefix.
# Our Q4_0 with no grammar and no reasoning budget (plain chat completions; the model writes JSON
# directly), and the bf16 GGUF the same way, on bench + learner-v2.
set -u
cd ~/code/italia/training && source mac.local.sh
LOG=~/italia-diag/ship-pipeline.log
G=out/gguf-round12m
step() { echo "=== $(date "+%F %T") $*" | tee -a $LOG; }
for v in q4:italia-tutor-e4b-q4_0-imat.gguf:round12m-q4-raw bf16:italia-tutor-e4b-bf16.gguf:round12m-bf16-raw; do
  a=${v%%:*}; rest=${v#*:}; f=${rest%%:*}; s=${rest#*:}
  step "$s: no grammar, no reasoning budget"
  work/llama.cpp/build/bin/llama-server -m $G/$f --port 8097 --alias $a -c 65536 -np 8 -ngl 99 --jinja >> ~/italia-diag/serve-ship.log 2>&1 &
  for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8097/v1/models | grep -q "\"$a\"" && break; sleep 5; done
  python3 ~/italia-diag/raw_predict.py http://127.0.0.1:8097 $a $s work/eval/bench.jsonl work/eval/bench-predictions.jsonl | tee -a $LOG
  python3 ~/italia-diag/raw_predict.py http://127.0.0.1:8097 $a $s work/eval/learner-v2.jsonl work/eval/learner-v2-predictions.jsonl | tee -a $LOG
  pkill -f "llama-server -m"; sleep 3
done
W=~/code/italia/training/work/eval O=~/italia-diag/shipped
PYTHONPATH=. uv run python ~/italia-diag/undercorrection.py work/eval/bench.jsonl work/eval/bench-predictions.jsonl \
  m12-k04 round12m-q4-rb0 round12m-q4-raw round12m-bf16-raw > ~/italia-diag/undercorrection-ship4.md 2>&1
cd ~/italia-wt-main/training
for m in raw snap; do
  f=(); [[ $m != raw ]] && f=(--as-shipped $m)
  uv run python -m eval report -c datagen/configs/local-mac.yaml --no-languagetool \
    --items $W/bench.jsonl --predictions $W/bench-predictions.jsonl --system m12-k04 --system round12m-q4-rb0 --system round12m-q4-raw --system round12m-bf16-raw $f \
    --out $O/ship4-bench-$m.md 2>&1 | grep -v httpx | tail -1
  uv run python -m eval learner-report --items $W/learner-v2.jsonl --predictions $W/learner-v2-predictions.jsonl \
    --system m12-k04 --system round12m-q4-rb0 --system round12m-q4-raw --system round12m-bf16-raw $f --out $O/ship4-learner-$m.md 2>&1 | tail -1
done
step "raw done"
