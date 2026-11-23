#!/bin/zsh
# Keeps the local teacher up for round 1. mlx_lm.server stays alive but answers 404 forever once
# its generation thread dies (Metal OOM / buffer-count limit), so watch the log and restart it.
cd ~/code/italia/training && source work-env.sh
export HF_HUB_OFFLINE=1
LOG=teacher.log
while true; do
  echo "=== start $(date) pc=2 cache=10 entries/2GB leak-fix" >> $LOG
  .venv/bin/python -m datagen.serve_teacher --model $LOCAL_TEACHER_MODEL --port 8080 \
    --decode-concurrency 8 --prompt-concurrency 2 \
    --prompt-cache-size 10 --prompt-cache-bytes 2147483648 >> $LOG 2>&1 &
  PID=$!
  FROM=$(( $(wc -l < $LOG) + 1 ))
  while kill -0 $PID 2>/dev/null; do
    if tail -n +$FROM $LOG | grep -q "generation thread died"; then
      echo "=== watchdog: generation thread died, restarting $(date)" | tee -a $LOG >> restarts.log
      kill $PID; sleep 5; kill -9 $PID 2>/dev/null
      break
    fi
    sleep 10
  done
  wait $PID 2>/dev/null
  sleep 5
done
