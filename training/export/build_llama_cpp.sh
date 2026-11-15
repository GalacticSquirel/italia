#!/usr/bin/env bash
# Build the llama.cpp tools the export needs (convert script, llama-quantize, llama-imatrix,
# llama-server, llama-bench) at the version llama.rn bundles, so the GGUF we ship loads in the app.
#
#   LLAMA_CPP_REF=b11804 CUDA=1 export/build_llama_cpp.sh   # from training/
#
# Update LLAMA_CPP_REF whenever the app upgrades llama.rn (its release notes name the llama.cpp
# build it is synced to; 0.13.0-rc.8 uses b11804).
set -euo pipefail

REF="${LLAMA_CPP_REF:-b11804}"
DEST="${LLAMA_CPP_DIR:-work/llama.cpp}"
JOBS="${JOBS:-$(nproc 2>/dev/null || sysctl -n hw.ncpu)}"

if [ ! -d "$DEST/.git" ]; then
  git clone --filter=blob:none https://github.com/ggml-org/llama.cpp "$DEST"
fi
git -C "$DEST" fetch --tags --quiet
git -C "$DEST" checkout --quiet "$REF"
echo "llama.cpp at $(git -C "$DEST" describe --tags) ($(git -C "$DEST" rev-parse --short HEAD))"

CMAKE_FLAGS=(-DCMAKE_BUILD_TYPE=Release -DLLAMA_CURL=OFF)
if [ "${CUDA:-0}" = "1" ]; then
  CMAKE_FLAGS+=(-DGGML_CUDA=ON)
fi
cmake -S "$DEST" -B "$DEST/build" "${CMAKE_FLAGS[@]}"
cmake --build "$DEST/build" -j "$JOBS" \
  --target llama-quantize llama-imatrix llama-server llama-bench llama-cli

# The convert script has its own Python requirements; keep them out of the training venv.
uv venv --quiet --allow-existing "$DEST/.venv"
VIRTUAL_ENV="$DEST/.venv" uv pip install --quiet -r "$DEST/requirements/requirements-convert_hf_to_gguf.txt"
echo "done: tools in $DEST/build/bin, convert venv in $DEST/.venv"
