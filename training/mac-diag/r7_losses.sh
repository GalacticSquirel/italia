#!/bin/zsh
# Read-only: serve the judge, re-judge round7 vs round6 keeping reasons, compute style stats, stop the judge.
cd ~/code/italia/training && source mac.local.sh
LOCAL_TEACHER_PORT=8081 scripts/serve-teacher.sh mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit >> judge-server.log 2>&1 &
for i in $(seq 1 60); do curl -s -m 3 http://127.0.0.1:8081/v1/models >/dev/null && break; sleep 5; done
LOCAL_JUDGE_URL=http://127.0.0.1:8081/v1 LOCAL_JUDGE_MODEL=mlx-community/Qwen3-Next-80B-A3B-Instruct-4bit \
  PYTHONPATH=. uv run python ~/italia-diag/r7_losses.py ~/italia-diag/r7-losses.jsonl > ~/italia-diag/r7-losses.log 2>&1
pkill -f datagen.serve_teacher
echo FINISHED >> ~/italia-diag/r7-losses.log
