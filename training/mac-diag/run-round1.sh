#!/bin/zsh
# Round 1: 10k jobs. Resumable: rerun this script. generate is rerun until every job is either
# done or has used its maxAttempts (3); a teacher crash only ends one invocation, then we wait
# for the server and resume. Then filter, judge, stats.
cd ~/code/italia/training && source work-env.sh
C=datagen/configs/local-mac.yaml
wait_teacher() { until curl -s -m 5 http://127.0.0.1:8080/v1/models >/dev/null; do sleep 10; done; }
for i in $(seq 1 500); do
  wait_teacher
  echo "=== generate run $i $(date)"
  out=$(uv run python -m datagen generate -c $C --yes 2>&1 | grep -v "httpx" | tee /dev/stderr)
  print -r -- "$out" | grep -q "nothing to do" && break
  sleep 20
done 2>&1
echo "=== filter $(date)"; uv run python -m datagen filter -c $C 2>&1 | grep -v httpx
wait_teacher
echo "=== judge $(date)";  uv run python -m datagen judge  -c $C 2>&1 | grep -v httpx
echo "=== stats $(date)";  uv run python -m datagen stats  -c $C
echo "=== done $(date)"
