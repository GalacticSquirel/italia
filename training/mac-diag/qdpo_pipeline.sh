#!/bin/zsh
# QAT-DPO from QAT-2 e2 with mx2-matched fake-quant (ffn_down/attn_output Q6_K, rest Q4_0):
# mine on-policy pairs from mx2 samples on train-split turns, DPO (beta 0.05, NLL 1.0, LR 5e-6
# cosine, 1 epoch, LoRA r64), export mx2 recipe (no imatrix), app-path eval, bar check, judge if pass.
# Writes ~/italia-diag/qdpo.done (or qdpo.failed) at the end.
set -u
cd ~/code/italia/training && source mac.local.sh
LOG=~/italia-diag/qdpo-pipeline.log
D=work/qdpo
B=work/llama.cpp/build/bin
G=out/gguf-round12m-qdpo
MX2=(--token-embedding-type q4_0 --tensor-type per_layer_token_embd=q4_0 --tensor-type ffn_down=q6_k --tensor-type attn_output=q6_k)
rm -f ~/italia-diag/qdpo.done ~/italia-diag/qdpo.failed
step() { echo "=== $(date "+%F %T") $*" | tee -a $LOG; }
die() { step "FAILED: $*"; echo "$*" > ~/italia-diag/qdpo.failed; pkill -f "llama-server -m"; pkill -f "mlx_lm.server"; exit 1; }
pkill -f "mlx_lm.server" 2>/dev/null; pkill -f "datagen.serve_teacher" 2>/dev/null; pkill -f "llama-server -m" 2>/dev/null; sleep 3
mkdir -p $D

step "mining items"
[[ -f $D/items.jsonl ]] || .venv/bin/python ~/italia-diag/qdpo_items.py 2>&1 | tee -a $LOG
[[ -s $D/items.jsonl ]] || die "no items"

step "mx2 samples (3 per turn, temperature 0.7, app path)"
if [[ ! -f $D/samples.ok ]]; then
  : > $D/systems.yaml; echo "systems:" >> $D/systems.yaml
  for k in 1 2 3; do
    printf "  - name: qdpo-s%s\n    endpoint:\n      protocol: openai\n      baseUrl: http://127.0.0.1:8097/v1\n      model: mx2\n      maxConcurrency: 16\n      extraBody: {chat_template_kwargs: {enable_thinking: false}}\n    constrained: true\n    temperature: 0.7\n" $k >> $D/systems.yaml
  done
  $B/llama-server -m out/gguf-round12m-qat2-e2/q4_0-mx2.gguf --port 8097 --alias mx2 -c 262144 -np 16 -ngl 99 --jinja --reasoning-budget 0 >> ~/italia-diag/serve-qdpo.log 2>&1 &
  ok=0; for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8097/v1/models | grep -q "\"mx2\"" && { ok=1; break; }; sleep 5; done
  [[ $ok == 1 ]] || die "mx2 server did not start"
  for k in 1 2 3; do
    uv run python -m eval predict --systems $D/systems.yaml --items $D/items.jsonl \
      --out $D/samples.jsonl --system qdpo-s$k 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
  done
  pkill -f "llama-server -m"; sleep 3
  touch $D/samples.ok
fi
PYTHONPATH=. uv run python ~/italia-diag/qdpo_cands.py $D/items.jsonl $D/samples.jsonl $D/cand-items.jsonl 2>&1 | tee -a $LOG

step "teacher (float round12m, greedy) on $(wc -l < $D/cand-items.jsonl | tr -d " ") candidate turns"
if [[ ! -f $D/teacher.ok ]]; then
  printf "systems:\n  - name: qdpo-teacher\n    endpoint:\n      protocol: openai\n      baseUrl: http://127.0.0.1:8096/v1\n      model: out/merged/round12m\n      maxConcurrency: 16\n      extraBody: {chat_template_kwargs: {enable_thinking: false}}\n    constrained: true\n" > $D/teacher.yaml
  .venv/bin/mlx_lm.server --model out/merged/round12m --port 8096 --decode-concurrency 16 --prompt-concurrency 4 >> ~/italia-diag/serve-qdpo.log 2>&1 &
  ok=0; for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8096/v1/models | grep -q round12m && { ok=1; break; }; sleep 5; done
  [[ $ok == 1 ]] || die "teacher server did not start"
  uv run python -m eval predict --systems $D/teacher.yaml --items $D/cand-items.jsonl \
    --out $D/teacher.jsonl --system qdpo-teacher 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
  pkill -f "mlx_lm.server"; sleep 3
  touch $D/teacher.ok
fi
PYTHONPATH=. uv run python ~/italia-diag/qdpo_pairs.py $D/items.jsonl $D/samples.jsonl $D/teacher.jsonl $D/pairs.jsonl 2>&1 | tee -a $LOG
[[ -s $D/pairs.jsonl ]] || die "no pairs"

step "QAT-DPO from QAT-2 e2 ($(wc -l < $D/pairs.jsonl | tr -d " ") pairs)"
if [[ ! -f out/mlx/round12m-qdpo/final/weights.safetensors ]]; then
  QAT_Q6K=1 PYTHONPATH=.:/Users/owen/italia-diag caffeinate -dimsu uv run --extra mlx python ~/italia-diag/qat.py dpo \
    -c train/configs/mlx/dpo-gemma4-e4b.yaml \
    --set policyModel=out/mlx/round12m-qat2/final --set pairsFile=$D/pairs.jsonl \
    --set beta=0.05 --set sftLossWeight=1.0 --set optim.learningRate=5.0e-6 \
    --set optim.lrScheduler=cosine --set optim.epochs=1 --set lora.r=64 --set lora.alpha=64 \
    --set valFraction=0.05 --set outputDir=out/mlx/round12m-qdpo >> ~/italia-diag/qdpo-train.log 2>&1 \
    || die "DPO failed (see qdpo-train.log)"
fi
grep -E "QAT Q4_0|validation" ~/italia-diag/qdpo-train.log | tail -4 | tee -a $LOG

step "export (fuse -> bf16 GGUF -> mx2 recipe, no imatrix)"
mkdir -p $G
if [[ ! -f $G/q4_0-mx2.gguf ]]; then
  [[ -f out/merged/round12m-qdpo/model.safetensors ]] || uv run --extra mlx python -m export mlx-fuse --model out/mlx/round12m-qdpo/final --out out/merged/round12m-qdpo 2>&1 | tail -1 | tee -a $LOG
  work/llama.cpp/.venv/bin/python work/llama.cpp/convert_hf_to_gguf.py out/merged/round12m-qdpo --outfile $G/bf16.gguf --outtype bf16 >> ~/italia-diag/qdpo-gguf.log 2>&1 || die "convert failed"
  rm -rf /Users/owen/code/italia/training/out/merged/round12m-qdpo
  $B/llama-quantize $MX2 $G/bf16.gguf $G/q4_0-mx2.gguf Q4_0 >> ~/italia-diag/qdpo-gguf.log 2>&1 || die "quantize failed"
  rm -f /Users/owen/code/italia/training/out/gguf-round12m-qdpo/bf16.gguf
fi
ls -l $G/q4_0-mx2.gguf | tee -a $LOG; shasum -a 256 $G/q4_0-mx2.gguf | tee -a $LOG
grep -q "name: qdpo-mx2" work/eval/systems-mac.yaml || printf "  - name: qdpo-mx2\n    endpoint:\n      protocol: openai\n      baseUrl: http://127.0.0.1:8097/v1\n      model: qdpo\n      maxConcurrency: 8\n      extraBody: {chat_template_kwargs: {enable_thinking: false}}\n    constrained: true\n" >> work/eval/systems-mac.yaml
$B/llama-server -m $G/q4_0-mx2.gguf --port 8097 --alias qdpo -c 65536 -np 8 -ngl 99 --jinja --reasoning-budget 0 >> ~/italia-diag/serve-qdpo.log 2>&1 &
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8097/v1/models | grep -q "\"qdpo\"" && break; sleep 5; done
for items in bench learner-v2; do
  uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/$items.jsonl \
    --out work/eval/$items-predictions.jsonl --system qdpo-mx2 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
done
pkill -f "llama-server -m"; sleep 3

step "score"
S=(m12-k04 qat2-e2-mx2 qdpo-mx2)
SA=(); for s in $S; do SA+=(--system $s); done
PYTHONPATH=. uv run python ~/italia-diag/undercorrection.py work/eval/bench.jsonl work/eval/bench-predictions.jsonl $S > ~/italia-diag/undercorrection-qdpo.md 2>&1
PYTHONPATH=. uv run python ~/italia-diag/overcorr.py work/eval/bench.jsonl work/eval/bench-predictions.jsonl qdpo-mx2 m12-k04 > ~/italia-diag/qdpo-overcorr.txt 2>&1
W=~/code/italia/training/work/eval O=~/italia-diag/shipped
cd ~/italia-wt-main/training
for m in raw snap; do
  f=(); [[ $m != raw ]] && f=(--as-shipped $m)
  uv run python -m eval report -c datagen/configs/local-mac.yaml --no-languagetool --items $W/bench.jsonl \
    --predictions $W/bench-predictions.jsonl $SA $f --out $O/qdpo-bench-$m.md 2>&1 | grep -v httpx | tail -1
  uv run python -m eval learner-report --items $W/learner-v2.jsonl --predictions $W/learner-v2-predictions.jsonl \
    $SA $f --out $O/qdpo-learner-$m.md 2>&1 | tail -1
done
cd ~/code/italia/training
python3 ~/italia-diag/qdpo_bar.py $O/qdpo-bench-snap.json $O/qdpo-learner-snap.md qdpo-mx2 2>&1 | tee ~/italia-diag/qdpo-bar.txt | tee -a $LOG
if grep -q "VERDICT: PASS" ~/italia-diag/qdpo-bar.txt; then
  step "judge (vs reference, pairwise vs mx2)"
  LOCAL_TEACHER_PORT=8081 caffeinate -dimsu scripts/serve-teacher.sh mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit >> judge-server.log 2>&1 &
  for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8081/v1/models >/dev/null && break; sleep 5; done
  LOCAL_JUDGE_URL=http://127.0.0.1:8081/v1 LOCAL_JUDGE_MODEL=mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit \
    uv run python -m eval report -c datagen/configs/local-mac.yaml --items work/eval/bench.jsonl \
    --predictions work/eval/bench-predictions.jsonl --system m12-k04 --system qat2-e2-mx2 --system qdpo-mx2 \
    --pairwise "qdpo-mx2:teacher-reference" --pairwise "qdpo-mx2:qat2-e2-mx2" \
    --title "QAT-DPO from QAT-2 e2, mx2 recipe, no imatrix (801 items)" \
    --note "app path: llama-server b11804 --reasoning-budget 0 + json_schema" \
    --out out/eval/bench-qdpo.md 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
  grep -E "^\| qdpo-mx2 \| (teacher-reference|qat2-e2-mx2) " out/eval/bench-qdpo.md | tee -a $LOG
  pkill -f "datagen.serve_teacher"
fi
step "qdpo done"
date > ~/italia-diag/qdpo.done
