#!/bin/zsh
# QAT round 2: teacher = float round12m (greedy), distillation set = QAT-1's 2,859 + ~2,700 new
# B1+-weighted, mostly multi-turn train turns; start from the QAT-1 model (QAT_PARENT =
# out/mlx/round12m-qat/final, fresh LoRA r64 on top), 2 epochs at LR 2e-5 with the same exact Q4_0
# fake-quant and last-turn-only loss; checkpoint at the end of each epoch. Export both epochs as
# Q4_0 (stock tensor types, no imatrix) and run the app-path eval (b11804, --reasoning-budget 0 +
# json_schema) on both.
set -u
cd ~/code/italia/training && source mac.local.sh
LOG=~/italia-diag/qat2-pipeline.log
D=work/qat2
B=work/llama.cpp/build/bin
STOCK=(--token-embedding-type q8_0 --tensor-type per_layer_token_embd=q4_0 --tensor-type ffn_down=q4_0)
step() { echo "=== $(date "+%F %T") $*" | tee -a $LOG; }
die() { step "FAILED: $*"; exit 1; }
pkill -f "mlx_lm.server" 2>/dev/null; pkill -f "datagen.serve_teacher" 2>/dev/null; pkill -f "llama-server -m" 2>/dev/null; sleep 3

step "teacher outputs (float round12m) on $(wc -l < $D/new-items.jsonl | tr -d " ") new turns"
printf "systems:\n  - name: qat-teacher-round12m\n    endpoint:\n      protocol: openai\n      baseUrl: http://127.0.0.1:8096/v1\n      model: out/merged/round12m\n      maxConcurrency: 16\n      extraBody: {chat_template_kwargs: {enable_thinking: false}}\n    constrained: true\n" > $D/systems.yaml
.venv/bin/mlx_lm.server --model out/merged/round12m --port 8096 --decode-concurrency 16 --prompt-concurrency 4 >> ~/italia-diag/serve-qat2.log 2>&1 &
ok=0; for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8096/v1/models | grep -q round12m && { ok=1; break; }; sleep 5; done
[[ $ok == 1 ]] || die "teacher server did not start"
uv run python -m eval predict --systems $D/systems.yaml --items $D/new-items.jsonl \
  --out $D/teacher-new.jsonl --system qat-teacher-round12m 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
pkill -f "mlx_lm.server"; sleep 3
PYTHONPATH=. uv run python - <<'EOF' 2>&1 | tee -a $LOG
import json, random
from pathlib import Path
from datagen.filters import parse_tutor_output
items = {json.loads(l)["id"]: json.loads(l) for l in open("work/qat2/new-items.jsonl", encoding="utf-8")}
new = []
for l in open("work/qat2/teacher-new.jsonl", encoding="utf-8"):
    r = json.loads(l)
    p, _ = parse_tutor_output(r["text"])
    if p is None:
        continue
    it = items[r["itemId"]]
    new.append({"id": it["id"], "level": it["level"], "scenarioId": it["scenarioId"],
                "messages": it["messages"] + [{"role": "assistant", "content": p.to_json()}]})
old = [json.loads(l) for l in open("work/qat/sft-round12m/sft.train.jsonl", encoding="utf-8")]
train = old + new
random.Random(11).shuffle(train)
out = Path("work/qat2/sft"); out.mkdir(parents=True, exist_ok=True)
with open(out / "sft.train.jsonl", "w", encoding="utf-8") as f:
    for row in train:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")
(out / "sft.val.jsonl").write_text(open("work/qat/sft-round12m/sft.val.jsonl", encoding="utf-8").read(), encoding="utf-8")
print(f"QAT-2 distill set: {len(train)} train ({len(old)} QAT-1 + {len(new)} new valid of {len(items)}), 100 val")
EOF
N=$(wc -l < $D/sft/sft.train.jsonl | tr -d " ")
SPE=$(( ( (N + 1) / 2 + 7 ) / 8 ))   # optimizer steps per epoch: micro-batch 2, accumulation 8
step "QAT-2 SFT: $N rows, 2 epochs, $SPE steps/epoch, checkpoint every $SPE"
if [[ ! -f out/mlx/round12m-qat2/final/weights.safetensors ]]; then
  QAT_PARENT=out/mlx/round12m-qat/final PYTHONPATH=.:/Users/owen/italia-diag caffeinate -dimsu uv run --extra mlx python ~/italia-diag/qat.py sft \
    -c train/configs/mlx/sft-gemma4-e4b-lora.yaml --set outputDir=out/mlx/round12m-qat2 \
    --set trainFile=$D/sft/sft.train.jsonl --set valFile=$D/sft/sft.val.jsonl \
    --set optim.learningRate=2.0e-5 --set optim.epochs=2 --set optim.warmupRatio=0.05 \
    --set saveSteps=$SPE --set evalSteps=$SPE \
    >> ~/italia-diag/qat2-train.log 2>&1 || die "QAT-2 training failed (see qat2-train.log)"
fi
grep -E "QAT Q4_0|validation|optimizer steps" ~/italia-diag/qat2-train.log | tail -4 | tee -a $LOG

step "epoch-1 adapter from checkpoint step $SPE"
CK=$(ls -d out/mlx/round12m-qat2/checkpoints/step-* 2>/dev/null | while read c; do n=${c##*step-}; (( 10#$n == SPE )) && echo $c; done | head -1)
[[ -n "$CK" ]] || die "no epoch-1 checkpoint at step $SPE"
mkdir -p out/mlx/round12m-qat2-e1/final
cp $CK/weights.safetensors out/mlx/round12m-qat2-e1/final/weights.safetensors
cp out/mlx/round12m-qat2/final/italia-train.json out/mlx/round12m-qat2/final/italia-train-config.json out/mlx/round12m-qat2-e1/final/
echo "epoch 1 = $CK" | tee -a $LOG

for e in e1 e2; do
  src=out/mlx/round12m-qat2-e1/final; [[ $e == e2 ]] && src=out/mlx/round12m-qat2/final
  name=round12m-qat2-$e; G=out/gguf-$name
  step "export $name (fuse -> bf16 GGUF -> Q4_0 stock types, no imatrix)"
  [[ -f out/merged/$name/model.safetensors ]] || uv run --extra mlx python -m export mlx-fuse --model $src --out out/merged/$name 2>&1 | tail -1 | tee -a $LOG
  mkdir -p $G
  [[ -f $G/q4_0.gguf ]] || {
    work/llama.cpp/.venv/bin/python work/llama.cpp/convert_hf_to_gguf.py out/merged/$name --outfile $G/bf16.gguf --outtype bf16 >> ~/italia-diag/qat2-gguf.log 2>&1 || die "convert $name failed"
    $B/llama-quantize $STOCK $G/bf16.gguf $G/q4_0.gguf Q4_0 >> ~/italia-diag/qat2-gguf.log 2>&1 || die "quantize $name failed"
    rm -f $G/bf16.gguf
  }
  rm -rf out/merged/$name   # keep disk: the adapter + lineage rebuild it
  ls -l $G/q4_0.gguf | tee -a $LOG; shasum -a 256 $G/q4_0.gguf | tee -a $LOG
  printf "  - name: %s-q4\n    endpoint:\n      protocol: openai\n      baseUrl: http://127.0.0.1:8097/v1\n      model: %s\n      maxConcurrency: 8\n      extraBody: {chat_template_kwargs: {enable_thinking: false}}\n    constrained: true\n" $name $e >> work/eval/systems-mac.yaml
  $B/llama-server -m $G/q4_0.gguf --port 8097 --alias $e -c 65536 -np 8 -ngl 99 --jinja --reasoning-budget 0 >> ~/italia-diag/serve-qat2.log 2>&1 &
  for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8097/v1/models | grep -q "\"$e\"" && break; sleep 5; done
  for items in bench learner-v2; do
    uv run python -m eval predict --systems work/eval/systems-mac.yaml --items work/eval/$items.jsonl \
      --out work/eval/$items-predictions.jsonl --system $name-q4 2>&1 | grep -v httpx | tail -1 | tee -a $LOG
  done
  pkill -f "llama-server -m"; sleep 3
  if [[ $e == e1 ]]; then
    PYTHONPATH=. uv run python ~/italia-diag/undercorrection.py work/eval/bench.jsonl work/eval/bench-predictions.jsonl m12-k04 $name-q4 \
      > ~/italia-diag/undercorrection-qat2-e1.md 2>&1
    head -1 ~/italia-diag/undercorrection-qat2-e1.md | tee -a $LOG
  fi
done

step "score"
S=(m12-k04 round12m-qat-q4 round12m-qat2-e1-q4 round12m-qat2-e2-q4)
SA=(); for s in $S; do SA+=(--system $s); done
PYTHONPATH=. uv run python ~/italia-diag/undercorrection.py work/eval/bench.jsonl work/eval/bench-predictions.jsonl $S > ~/italia-diag/undercorrection-qat2.md 2>&1
W=~/code/italia/training/work/eval O=~/italia-diag/shipped
cd ~/italia-wt-main/training
for m in raw snap; do
  f=(); [[ $m != raw ]] && f=(--as-shipped $m)
  uv run python -m eval report -c datagen/configs/local-mac.yaml --no-languagetool --items $W/bench.jsonl \
    --predictions $W/bench-predictions.jsonl $SA $f --out $O/qat2-bench-$m.md 2>&1 | grep -v httpx | tail -1
  uv run python -m eval learner-report --items $W/learner-v2.jsonl --predictions $W/learner-v2-predictions.jsonl \
    $SA $f --out $O/qat2-learner-$m.md 2>&1 | tail -1
done
step "qat2 done"
