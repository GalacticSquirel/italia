#!/bin/zsh
cd ~/code/italia/training && source mac.local.sh
export TARGET_DIALOGUES=10000 LOCAL_JUDGE_URL=http://127.0.0.1:8081/v1 LOCAL_JUDGE_MODEL=mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit
for i in 1 2; do uv run python -m datagen judge -c work/judge-handwritten-x.yaml; done
uv run python -m datagen stats -c work/judge-handwritten-x.yaml
echo "=== done $(date)"
