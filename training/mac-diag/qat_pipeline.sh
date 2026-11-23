#!/bin/zsh
# QAT for GGUF Q4_0: self-distillation SFT with exact Q4_0 fake-quant (italia-diag/qat.py) from the
# best float model, then Q4_0 exports (stock tensor types; no imatrix = exactly the simulated
# quantiser, and with imatrix), served the app way (llama-server b11804, --reasoning-budget 0 +
# json_schema), bench + learner-v2, raw/snap vs float.
# usage: qat_pipeline.sh <model>   e.g. round12m (fused out/merged/<model>, MLX out/mlx/<model>/final,
#        float predictions stored under system $FLOAT_SYS)
set -u
M=$1
FLOAT_SYS=${FLOAT_SYS:-$M}
cd ~/code/italia/training && source mac.local.sh
LOG=~/italia-diag/qat-pipeline.log
D=work/qat
G=out/gguf-$M-qat
B=work/llama.cpp/build/bin
step() { echo "=== $(date "+%F %T") $*" | tee -a $LOG; }
die() { step "FAILED: $*"; exit 1; }
pkill -f "mlx_lm.server" 2>/dev/null; pkill -f "datagen.serve_teacher" 2>/dev/null; pkill -f "llama-server -m" 2>/dev/null; sleep 3
[[ -f out/mlx/$M/final/weights.safetensors ]] || die "no MLX output out/mlx/$M/final (wrap it with full_delta.py first)"

step "teacher outputs: $M greedy on $(wc -l < $D/distill-items.jsonl | tr -d " ") train turns"
printf "systems:\n  - name: qat-teacher-$M\n    endpoint:\n      protocol: openai\n      baseUrl: http://127.0.0.1:8096/v1\n      model: out/merged/$M\n      maxConcurrency: 16\n      extraBody: {chat_template_kwargs: {enable_thinking: false}}\n    constrained: true\n" > $D/systems-$M.yaml
.venv/bin/mlx_lm.server --model out/merged/$M --port 8096 --decode-concurrency 16 --prompt-concurrency 4 >> ~/italia-diag/serve-qat.log 2>&1 &
ok=0; for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8096/v1/models | grep -q "$M" && { ok=1; break; }; sleep 5; done
[[ $ok == 1 ]] || die "teacher server did not start"
uv run python -m eval predict --systems $D/systems-$M.yaml --items $D/distill-items.jsonl \
  --out $D/teacher-$M.jsonl --system qat-teacher-$M 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
pkill -f "mlx_lm.server"; sleep 3
PYTHONPATH=. uv run python - "$D/distill-items.jsonl" "$D/teacher-$M.jsonl" "$D/sft-$M" <<'EOF' 2>&1 | tee -a $LOG
import json, random, sys
from pathlib import Path
from datagen.filters import parse_tutor_output
items = {json.loads(l)["id"]: json.loads(l) for l in open(sys.argv[1], encoding="utf-8")}
rows = []
for l in open(sys.argv[2], encoding="utf-8"):
    r = json.loads(l)
    p, _ = parse_tutor_output(r["text"])
    if p is None:
        continue
    it = items[r["itemId"]]
    rows.append({"id": it["id"], "level": it["level"], "scenarioId": it["scenarioId"],
                 "messages": it["messages"] + [{"role": "assistant", "content": p.to_json()}]})
random.Random(7).shuffle(rows)
out = Path(sys.argv[3]); out.mkdir(parents=True, exist_ok=True)
val, train = rows[:100], rows[100:]
for name, part in (("train", train), ("val", val)):
    with open(out / f"sft.{name}.jsonl", "w", encoding="utf-8") as f:
        for row in part:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
print(f"distill SFT: {len(train)} train / {len(val)} val (valid teacher outputs {len(rows)} of {len(items)})")
EOF

step "QAT SFT (Q4_0 fake-quant) from out/mlx/$M/final"
if [[ ! -f out/mlx/$M-qat/final/weights.safetensors ]]; then
  QAT_PARENT=out/mlx/$M/final PYTHONPATH=.:/Users/owen/italia-diag caffeinate -dimsu uv run --extra mlx python ~/italia-diag/qat.py sft \
    -c train/configs/mlx/sft-gemma4-e4b-lora.yaml --set outputDir=out/mlx/$M-qat \
    --set trainFile=$D/sft-$M/sft.train.jsonl --set valFile=$D/sft-$M/sft.val.jsonl \
    --set optim.learningRate=2.0e-5 --set optim.epochs=1 --set optim.warmupRatio=0.05 \
    >> ~/italia-diag/qat-train-$M.log 2>&1 || die "QAT training failed (see qat-train-$M.log)"
fi
grep -E "QAT Q4_0|validation" ~/italia-diag/qat-train-$M.log | tail -3 | tee -a $LOG

step "fuse + GGUF"
[[ -f out/merged/$M-qat/model.safetensors ]] || uv run --extra mlx python -m export mlx-fuse \
  --model out/mlx/$M-qat/final --out out/merged/$M-qat 2>&1 | tail -1 | tee -a $LOG
mkdir -p $G
[[ -f $G/bf16.gguf ]] || work/llama.cpp/.venv/bin/python work/llama.cpp/convert_hf_to_gguf.py out/merged/$M-qat \
  --outfile $G/bf16.gguf --outtype bf16 >> ~/italia-diag/qat-gguf.log 2>&1 || die "convert failed"
STOCK=(--token-embedding-type q8_0 --tensor-type per_layer_token_embd=q4_0 --tensor-type ffn_down=q4_0)
[[ -f $G/q4_0.gguf ]] || $B/llama-quantize $STOCK $G/bf16.gguf $G/q4_0.gguf Q4_0 >> ~/italia-diag/qat-gguf.log 2>&1 || die "quantize failed"
[[ -f $G/imatrix.dat ]] || $B/llama-imatrix -m $G/bf16.gguf -f work/calibration.txt -o $G/imatrix.dat -ngl 99 >> ~/italia-diag/qat-gguf.log 2>&1
[[ -f $G/q4_0-imat.gguf ]] || $B/llama-quantize --imatrix $G/imatrix.dat $STOCK $G/bf16.gguf $G/q4_0-imat.gguf Q4_0 >> ~/italia-diag/qat-gguf.log 2>&1 || die "imatrix quantize failed"
for f in $G/q4_0.gguf $G/q4_0-imat.gguf; do ls -l $f | tee -a $LOG; shasum -a 256 $f | tee -a $LOG; done

step "eval: float $M-qat (mlx) + both Q4_0 (app path)"
printf "  - name: %s-qat\n    endpoint:\n      protocol: openai\n      baseUrl: http://127.0.0.1:8096/v1\n      model: out/merged/%s-qat\n      maxConcurrency: 16\n      extraBody: {chat_template_kwargs: {enable_thinking: false}}\n    constrained: true\n" $M $M >> work/eval/systems-mac.yaml
for a in q4 q4i; do
  printf "  - name: %s-qat-%s\n    endpoint:\n      protocol: openai\n      baseUrl: http://127.0.0.1:8097/v1\n      model: %s\n      maxConcurrency: 8\n      extraBody: {chat_template_kwargs: {enable_thinking: false}}\n    constrained: true\n" $M $a $a >> work/eval/systems-mac.yaml
done
.venv/bin/mlx_lm.server --model out/merged/$M-qat --port 8096 --decode-concurrency 16 --prompt-concurrency 4 >> ~/italia-diag/serve-qat.log 2>&1 &
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8096/v1/models | grep -q "$M-qat" && break; sleep 5; done
for items in bench learner-v2; do
  uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/$items.jsonl \
    --out work/eval/$items-predictions.jsonl --system $M-qat 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
done
pkill -f "mlx_lm.server"; sleep 3
for v in q4:q4_0.gguf q4i:q4_0-imat.gguf; do
  a=${v%%:*}; f=${v#*:}
  $B/llama-server -m $G/$f --port 8097 --alias $a -c 65536 -np 8 -ngl 99 --jinja --reasoning-budget 0 >> ~/italia-diag/serve-qat.log 2>&1 &
  for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8097/v1/models | grep -q "\"$a\"" && break; sleep 5; done
  for items in bench learner-v2; do
    uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/$items.jsonl \
      --out work/eval/$items-predictions.jsonl --system $M-qat-$a 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
  done
  pkill -f "llama-server -m"; sleep 3
done

step "score"
S=($FLOAT_SYS $M-qat $M-qat-q4 $M-qat-q4i)
SA=(); for s in $S; do SA+=(--system $s); done
PYTHONPATH=. uv run python ~/italia-diag/undercorrection.py work/eval/bench.jsonl work/eval/bench-predictions.jsonl $S > ~/italia-diag/undercorrection-qat-$M.md 2>&1
W=~/code/italia/training/work/eval O=~/italia-diag/shipped
cd ~/italia-wt-main/training
for m in raw snap; do
  f=(); [[ $m != raw ]] && f=(--as-shipped $m)
  uv run python -m eval report -c datagen/configs/local-mac.yaml --no-languagetool --items $W/bench.jsonl \
    --predictions $W/bench-predictions.jsonl $SA $f --out $O/qat-$M-bench-$m.md 2>&1 | grep -v httpx | tail -1
  uv run python -m eval learner-report --items $W/learner-v2.jsonl --predictions $W/learner-v2-predictions.jsonl \
    $SA $f --out $O/qat-$M-learner-$m.md 2>&1 | tail -1
done
step "qat done"
