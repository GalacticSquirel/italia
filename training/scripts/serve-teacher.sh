#!/usr/bin/env bash
# Serve the local teacher with mlx-lm's OpenAI-compatible server, sized for this Mac's memory.
# It runs through datagen.serve_teacher, which fixes mlx-lm's Metal buffer leak in batched decode
# (the "[metal::malloc] Resource limit (499000) exceeded" crash; datagen/mlx_compat.py) first.
#
#   training/scripts/serve-teacher.sh [model]
#
# The model defaults to $LOCAL_TEACHER_MODEL. Server limits default by unified memory and can be
# overridden with DECODE_CONCURRENCY, PROMPT_CONCURRENCY and PROMPT_CACHE_BYTES:
#
#   64 GB or less:  decode 8, prompt 2, prompt cache 2 GiB (the 80B-A3B teacher leaves ~15 GB)
#   more:           decode 8, prompt 4, prompt cache 8 GiB
#
# On 64 GB, also raise the GPU wired limit first (resets on reboot):
#   sudo sysctl iogpu.wired_limit_mb=57344
set -euo pipefail

cd "$(dirname "$0")/.."
for env_file in ./*.local.sh; do
  # shellcheck source=/dev/null
  [[ -f "$env_file" ]] && source "$env_file"
done

model="${1:-${LOCAL_TEACHER_MODEL:?set LOCAL_TEACHER_MODEL or pass the model}}"
mem_gb=64
if command -v sysctl >/dev/null && sysctl -n hw.memsize >/dev/null 2>&1; then
  mem_gb=$(( $(sysctl -n hw.memsize) / 1024 / 1024 / 1024 ))
fi
if (( mem_gb <= 64 )); then
  prompt_default=2
  cache_default=$(( 2 * 1024 * 1024 * 1024 ))
else
  prompt_default=4
  cache_default=$(( 8 * 1024 * 1024 * 1024 ))
fi

# datagen.serve_teacher exits with 75 when mlx-lm's generation thread dies (e.g. a rare Metal
# out-of-memory during prefill); start it again. Any other exit ends the script.
while true; do
  status=0
  uv run --extra mlx python -m datagen.serve_teacher --model "$model" \
    --host "${LOCAL_TEACHER_HOST:-127.0.0.1}" --port "${LOCAL_TEACHER_PORT:-8080}" \
    --decode-concurrency "${DECODE_CONCURRENCY:-8}" \
    --prompt-concurrency "${PROMPT_CONCURRENCY:-$prompt_default}" \
    --prompt-cache-bytes "${PROMPT_CACHE_BYTES:-$cache_default}" || status=$?
  if (( status != 75 )); then
    exit "$status"
  fi
  echo "==> $(date '+%F %T') teacher generation thread died; restarting" >&2
  sleep 5
done
