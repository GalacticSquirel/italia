#!/bin/zsh
cd ~/code/italia/training && source mac.local.sh
export LOCAL_CONCURRENCY=4 TARGET_DIALOGUES=10000 LOCAL_JUDGE_URL=http://127.0.0.1:8081/v1 LOCAL_JUDGE_MODEL=mlx-community/Llama-3.3-70B-Instruct-4bit
until uv run python -m datagen judge -c datagen/configs/local-mac.yaml; do echo "judge stopped; retrying in 30 s"; sleep 30; done
uv run python -m datagen stats -c datagen/configs/local-mac.yaml
echo "=== done $(date)"
