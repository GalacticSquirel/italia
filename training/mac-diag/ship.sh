#!/bin/zsh
# Ship check of round12m: build llama.cpp (b11804, the llama.rn version), calibration text, bf16 GGUF
# -> imatrix -> Q4_0 (release pipeline), smoke test, serve with llama-server (constrained decoding
# as on the phone), bench + learner-v2, raw/snap scoring. Local only; nothing uploaded.
set -u
cd ~/code/italia/training && source mac.local.sh
LOG=~/italia-diag/ship-pipeline.log
step() { echo "=== $(date "+%F %T") $*" | tee -a $LOG; }
die() { step "FAILED: $*"; exit 1; }
step "build llama.cpp"
[[ -x work/llama.cpp/build/bin/llama-server ]] || export/build_llama_cpp.sh >> ~/italia-diag/llama-build.log 2>&1 || die "llama.cpp build failed"
tail -1 ~/italia-diag/llama-build.log | tee -a $LOG
step "calibration text"
[[ -s work/calibration.txt ]] || uv run python -m export calibration --sft work/sft-round8/sft.train.jsonl --out work/calibration.txt 2>&1 | tail -1 | tee -a $LOG
step "GGUF: convert + imatrix + Q4_0"
uv run python -m export gguf --model out/merged/round12m --id italia-tutor-e4b --quant Q4_0 \
  --imatrix work/calibration.txt --out-dir out/gguf-round12m >> ~/italia-diag/ship-gguf.log 2>&1 || die "gguf export failed (see ship-gguf.log)"
grep "^output:" ~/italia-diag/ship-gguf.log | tee -a $LOG
Q=$(grep "^output:" ~/italia-diag/ship-gguf.log | tail -1 | sed "s/^output: //")
[[ -f $Q ]] || die "no Q4_0 file"
ls -l $Q | tee -a $LOG; shasum -a 256 $Q | tee -a $LOG
step "smoke"
uv run python -m export smoke --gguf $Q 2>&1 | tail -8 | tee -a $LOG
step "serve + predict (llama-server :8097, constrained)"
work/llama.cpp/build/bin/llama-server -m $Q --port 8097 --alias italia-tutor-e4b-q4_0-imat -c 65536 -np 8 \
  -ngl 99 --jinja >> ~/italia-diag/serve-ship.log 2>&1 &
ok=0; for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8097/v1/models | grep -q italia-tutor && { ok=1; break; }; sleep 5; done
[[ $ok == 1 ]] || die "llama-server did not start"
uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/bench.jsonl \
  --out work/eval/bench-predictions.jsonl --system round12m-q4 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/learner-v2.jsonl \
  --out work/eval/learner-v2-predictions.jsonl --system round12m-q4 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
pkill -f "llama-server -m"; sleep 3
step "score"
PYTHONPATH=. uv run python ~/italia-diag/undercorrection.py work/eval/bench.jsonl \
  work/eval/bench-predictions.jsonl m12-k04 round12m-q4 > ~/italia-diag/undercorrection-ship.md 2>&1
W=~/code/italia/training/work/eval O=~/italia-diag/shipped
cd ~/italia-wt-main/training
for m in raw snap; do
  f=(); [[ $m != raw ]] && f=(--as-shipped $m)
  uv run python -m eval report -c datagen/configs/local-mac.yaml \
    --items $W/bench.jsonl --predictions $W/bench-predictions.jsonl --system m12-k04 --system round12m-q4 $f \
    --out $O/ship-bench-$m.md 2>&1 | grep -v httpx | tail -1
  uv run python -m eval learner-report --items $W/learner-v2.jsonl \
    --predictions $W/learner-v2-predictions.jsonl --system m12-k04 --system round12m-q4 $f --out $O/ship-learner-$m.md 2>&1 | tail -1
done
step "done"
