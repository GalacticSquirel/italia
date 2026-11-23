#!/bin/zsh
# QAT-3: over-correction rebalanced distillation from QAT-2 e2, 1 epoch LR 1e-5, fake-quant matching
# mx2 (ffn_down/attn_output Q6_K, rest Q4_0); export mx2 recipe, no imatrix; app-path eval; score.
set -u
cd ~/code/italia/training && source mac.local.sh
LOG=~/italia-diag/qat3-pipeline.log
D=work/qat3
B=work/llama.cpp/build/bin
G=out/gguf-round12m-qat3
MX2=(--token-embedding-type q4_0 --tensor-type per_layer_token_embd=q4_0 --tensor-type ffn_down=q6_k --tensor-type attn_output=q6_k)
step() { echo "=== $(date "+%F %T") $*" | tee -a $LOG; }
die() { step "FAILED: $*"; exit 1; }
pkill -f "mlx_lm.server" 2>/dev/null; pkill -f "datagen.serve_teacher" 2>/dev/null; pkill -f "llama-server -m" 2>/dev/null; sleep 3
mkdir -p $D
step "items"
[[ -f $D/new-items.jsonl ]] || .venv/bin/python ~/italia-diag/qat3_items.py 2>&1 | tee -a $LOG
step "teacher outputs (float round12m) on $(wc -l < $D/new-items.jsonl | tr -d " ") new turns"
if [[ ! -s $D/teacher-new.jsonl ]]; then
  printf "systems:\n  - name: qat-teacher-round12m\n    endpoint:\n      protocol: openai\n      baseUrl: http://127.0.0.1:8096/v1\n      model: out/merged/round12m\n      maxConcurrency: 16\n      extraBody: {chat_template_kwargs: {enable_thinking: false}}\n    constrained: true\n" > $D/systems.yaml
  .venv/bin/mlx_lm.server --model out/merged/round12m --port 8096 --decode-concurrency 16 --prompt-concurrency 4 >> ~/italia-diag/serve-qat3.log 2>&1 &
  ok=0; for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8096/v1/models | grep -q round12m && { ok=1; break; }; sleep 5; done
  [[ $ok == 1 ]] || die "teacher server did not start"
  uv run python -m eval predict --systems $D/systems.yaml --items $D/new-items.jsonl \
    --out $D/teacher-new.jsonl --system qat-teacher-round12m 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
  pkill -f "mlx_lm.server"; sleep 3
fi
PYTHONPATH=. uv run python ~/italia-diag/qat3_assemble.py 2>&1 | tee -a $LOG
N=$(wc -l < $D/sft/sft.train.jsonl | tr -d " ")
step "QAT-3 SFT: $N rows, 1 epoch, LR 1e-5, Q6_K fake-quant on ffn_down/attn_output"
if [[ ! -f out/mlx/round12m-qat3/final/weights.safetensors ]]; then
  QAT_Q6K=1 QAT_PARENT=out/mlx/round12m-qat2/final PYTHONPATH=.:/Users/owen/italia-diag caffeinate -dimsu uv run --extra mlx python ~/italia-diag/qat.py sft \
    -c train/configs/mlx/sft-gemma4-e4b-lora.yaml --set outputDir=out/mlx/round12m-qat3 \
    --set trainFile=$D/sft/sft.train.jsonl --set valFile=$D/sft/sft.val.jsonl \
    --set optim.learningRate=1.0e-5 --set optim.epochs=1 --set optim.warmupRatio=0.05 \
    >> ~/italia-diag/qat3-train.log 2>&1 || die "QAT-3 training failed (see qat3-train.log)"
fi
grep -E "QAT Q4_0|validation|optimizer steps" ~/italia-diag/qat3-train.log | tail -4 | tee -a $LOG

step "export (fuse -> bf16 GGUF -> mx2 recipe, no imatrix)"
mkdir -p $G
if [[ ! -f $G/q4_0-mx2.gguf ]]; then
  [[ -f out/merged/round12m-qat3/model.safetensors ]] || uv run --extra mlx python -m export mlx-fuse --model out/mlx/round12m-qat3/final --out out/merged/round12m-qat3 2>&1 | tail -1 | tee -a $LOG
  work/llama.cpp/.venv/bin/python work/llama.cpp/convert_hf_to_gguf.py out/merged/round12m-qat3 --outfile $G/bf16.gguf --outtype bf16 >> ~/italia-diag/qat3-gguf.log 2>&1 || die "convert failed"
  rm -rf /Users/owen/code/italia/training/out/merged/round12m-qat3
  $B/llama-quantize $MX2 $G/bf16.gguf $G/q4_0-mx2.gguf Q4_0 >> ~/italia-diag/qat3-gguf.log 2>&1 || die "quantize failed"
  rm -f /Users/owen/code/italia/training/out/gguf-round12m-qat3/bf16.gguf
fi
ls -l $G/q4_0-mx2.gguf | tee -a $LOG; shasum -a 256 $G/q4_0-mx2.gguf | tee -a $LOG
printf "  - name: qat3-mx2\n    endpoint:\n      protocol: openai\n      baseUrl: http://127.0.0.1:8097/v1\n      model: qat3\n      maxConcurrency: 8\n      extraBody: {chat_template_kwargs: {enable_thinking: false}}\n    constrained: true\n" >> work/eval/systems-mac.yaml
$B/llama-server -m $G/q4_0-mx2.gguf --port 8097 --alias qat3 -c 65536 -np 8 -ngl 99 --jinja --reasoning-budget 0 >> ~/italia-diag/serve-qat3.log 2>&1 &
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8097/v1/models | grep -q "\"qat3\"" && break; sleep 5; done
for items in bench learner-v2; do
  uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/$items.jsonl \
    --out work/eval/$items-predictions.jsonl --system qat3-mx2 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
done
pkill -f "llama-server -m"; sleep 3

step "score"
S=(m12-k04 qat2-e2-mx2 qat3-mx2)
SA=(); for s in $S; do SA+=(--system $s); done
PYTHONPATH=. uv run python ~/italia-diag/undercorrection.py work/eval/bench.jsonl work/eval/bench-predictions.jsonl $S > ~/italia-diag/undercorrection-qat3.md 2>&1
PYTHONPATH=. uv run python ~/italia-diag/overcorr.py work/eval/bench.jsonl work/eval/bench-predictions.jsonl qat3-mx2 m12-k04 > ~/italia-diag/qat3-overcorr.txt 2>&1
W=~/code/italia/training/work/eval O=~/italia-diag/shipped
cd ~/italia-wt-main/training
for m in raw snap; do
  f=(); [[ $m != raw ]] && f=(--as-shipped $m)
  uv run python -m eval report -c datagen/configs/local-mac.yaml --no-languagetool --items $W/bench.jsonl \
    --predictions $W/bench-predictions.jsonl $SA $f --out $O/qat3-bench-$m.md 2>&1 | grep -v httpx | tail -1
  uv run python -m eval learner-report --items $W/learner-v2.jsonl --predictions $W/learner-v2-predictions.jsonl \
    $SA $f --out $O/qat3-learner-$m.md 2>&1 | tail -1
done
step "qat3 done"
