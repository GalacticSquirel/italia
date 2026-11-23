#!/bin/zsh
# (1) Judge QAT-2 epoch 2 Q4_0 vs reference and pairwise vs QAT-1 Q4_0 (predictions already stored).
# (2) Size-neutral mixed precision from the QAT-2 epoch-2 weights (no training): re-make the bf16
#     GGUF, quantize 3 override variants (no imatrix), app-path eval each, CPU speed check.
set -u
cd ~/code/italia/training && source mac.local.sh
LOG=~/italia-diag/mixq-pipeline.log
B=work/llama.cpp/build/bin
G=out/gguf-round12m-qat2-e2
step() { echo "=== $(date "+%F %T") $*" | tee -a $LOG; }
die() { step "FAILED: $*"; exit 1; }
pkill -f "mlx_lm.server" 2>/dev/null; pkill -f "llama-server -m" 2>/dev/null; sleep 3

step "judge QAT-2 e2 Q4_0 (vs reference, pairwise vs QAT-1 Q4_0)"
LOCAL_TEACHER_PORT=8081 caffeinate -dimsu scripts/serve-teacher.sh mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit >> judge-server.log 2>&1 &
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8081/v1/models >/dev/null && break; sleep 5; done
LOCAL_JUDGE_URL=http://127.0.0.1:8081/v1 LOCAL_JUDGE_MODEL=mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit \
  uv run python -m eval report -c datagen/configs/local-mac.yaml --items work/eval/bench.jsonl \
  --predictions work/eval/bench-predictions.jsonl --system m12-k04 --system round12m-qat-q4 --system "round12m-qat2-e2-q4" \
  --pairwise "round12m-qat2-e2-q4:teacher-reference" --pairwise "round12m-qat2-e2-q4:round12m-qat-q4" \
  --title "QAT-2 epoch 2, Q4_0 stock types, no imatrix (801 items)" \
  --note "app path: llama-server b11804 --reasoning-budget 0 + json_schema" \
  --out out/eval/bench-qat2-e2.md 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
grep -E "^\| round12m-qat2-e2-q4 \| (teacher-reference|round12m-qat-q4) " out/eval/bench-qat2-e2.md | tee -a $LOG
pkill -f "datagen.serve_teacher"; sleep 5

step "re-make bf16 GGUF of QAT-2 epoch 2"
[[ -f $G/bf16.gguf ]] || {
  uv run --extra mlx python -m export mlx-fuse --model out/mlx/round12m-qat2/final --out out/merged/round12m-qat2-e2 2>&1 | tail -1 | tee -a $LOG
  work/llama.cpp/.venv/bin/python work/llama.cpp/convert_hf_to_gguf.py out/merged/round12m-qat2-e2 --outfile $G/bf16.gguf --outtype bf16 >> ~/italia-diag/mixq-gguf.log 2>&1 || die "convert failed"
  rm -rf /Users/owen/code/italia/training/out/merged/round12m-qat2-e2
}
LATE='blk\.(2[1-9]|3[0-9]|4[01])\.ffn_down'
typeset -A VAR
VAR[mx1]="--token-embedding-type q5_0 --tensor-type per_layer_token_embd=q4_0 --tensor-type ffn_down=q5_0 --tensor-type attn_output=q5_0"
VAR[mx2]="--token-embedding-type q4_0 --tensor-type per_layer_token_embd=q4_0 --tensor-type ffn_down=q6_k --tensor-type attn_output=q6_k"
VAR[mx3]="--token-embedding-type q6_k --tensor-type per_layer_token_embd=q4_0 --tensor-type ffn_down=q4_0 --tensor-type $LATE=q6_k --tensor-type attn_output=q6_k"
for v in mx1 mx2 mx3; do
  step "quantize $v: ${VAR[$v]}"
  [[ -f $G/q4_0-$v.gguf ]] || $B/llama-quantize ${=VAR[$v]} $G/bf16.gguf $G/q4_0-$v.gguf Q4_0 >> ~/italia-diag/mixq-quant.log 2>&1 || die "quantize $v failed"
  ls -l $G/q4_0-$v.gguf | tee -a $LOG; shasum -a 256 $G/q4_0-$v.gguf | tee -a $LOG
  printf "  - name: qat2-e2-%s\n    endpoint:\n      protocol: openai\n      baseUrl: http://127.0.0.1:8097/v1\n      model: %s\n      maxConcurrency: 8\n      extraBody: {chat_template_kwargs: {enable_thinking: false}}\n    constrained: true\n" $v $v >> work/eval/systems-mac.yaml
  $B/llama-server -m $G/q4_0-$v.gguf --port 8097 --alias $v -c 65536 -np 8 -ngl 99 --jinja --reasoning-budget 0 >> ~/italia-diag/serve-mixq.log 2>&1 &
  for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8097/v1/models | grep -q "\"$v\"" && break; sleep 5; done
  for items in bench learner-v2; do
    uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/$items.jsonl \
      --out work/eval/$items-predictions.jsonl --system qat2-e2-$v 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
  done
  pkill -f "llama-server -m"; sleep 3
done
rm -f $G/bf16.gguf

step "CPU speed check (llama-bench, 4 threads, no GPU offload)"
for f in $G/q4_0.gguf $G/q4_0-mx2.gguf; do
  $B/llama-bench -m $f -t 4 -ngl 0 -p 512 -n 64 -r 2 2>/dev/null | grep -E "pp512|tg64" | sed "s|^|$(basename $f): |" | tee -a $LOG
done

step "score"
S=(m12-k04 round12m-qat2-e2-q4 qat2-e2-mx1 qat2-e2-mx2 qat2-e2-mx3)
SA=(); for s in $S; do SA+=(--system $s); done
PYTHONPATH=. uv run python ~/italia-diag/undercorrection.py work/eval/bench.jsonl work/eval/bench-predictions.jsonl $S > ~/italia-diag/undercorrection-mixq.md 2>&1
W=~/code/italia/training/work/eval O=~/italia-diag/shipped
cd ~/italia-wt-main/training
for m in raw snap; do
  f=(); [[ $m != raw ]] && f=(--as-shipped $m)
  uv run python -m eval report -c datagen/configs/local-mac.yaml --no-languagetool --items $W/bench.jsonl \
    --predictions $W/bench-predictions.jsonl $SA $f --out $O/mixq-bench-$m.md 2>&1 | grep -v httpx | tail -1
  uv run python -m eval learner-report --items $W/learner-v2.jsonl --predictions $W/learner-v2-predictions.jsonl \
    $SA $f --out $O/mixq-learner-$m.md 2>&1 | tail -1
done
step "mixq done"
