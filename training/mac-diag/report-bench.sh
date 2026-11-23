#!/bin/zsh
cd ~/code/italia/training && source mac.local.sh
export TARGET_DIALOGUES=10000 LOCAL_JUDGE_URL=http://127.0.0.1:8081/v1 LOCAL_JUDGE_MODEL=mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit
time uv run python -m eval report -c datagen/configs/local-mac.yaml --items work/eval/bench.jsonl \
  --predictions work/eval/bench-predictions.jsonl --system base --system round1-baseline \
  --pairwise base:teacher-reference --pairwise round1-baseline:teacher-reference \
  --title "Round-1 baseline vs base on the hand-written benchmark (801 items)" \
  --note "base = google/gemma-4-E4B-it-qat-q4_0-unquantized, round1-baseline = its LoRA SFT on 874 round-1 dialogues; both served by mlx_lm.server with thinking off and no JSON constraint" \
  --out out/eval/bench-round1.md
echo "=== done $(date)"
