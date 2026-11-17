#!/usr/bin/env bash
# Run (or resume) one data-generation round end to end, without prompts.
#
#   training/scripts/run-round.sh <config> <n>
#
# <config> is a datagen config (e.g. datagen/configs/local-mac.yaml), <n> the number of jobs
# (TARGET_DIALOGUES). Every stage resumes: rerun the same command after an interruption, or with
# a larger <n> to extend the round in the same output folder (the job list is prefix-stable).
#
# Stages: generate -> refilter (filters + dedupe, recovers failed jobs the parser now accepts,
# drops judged rows that no longer pass) -> judge -> stats, and build-sft when SFT_OUT is set.
#
# Machine-specific settings (LOCAL_TEACHER_MODEL, LOCAL_PROMPT_TPS, ...) go in an untracked
# training/<name>.local.sh, which this script sources; *.local.sh is git-ignored.
# FILTER_ARGS passes extra flags to refilter (e.g. --no-languagetool).
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: $0 <config> <n>" >&2
  exit 2
fi
config="$1"
export TARGET_DIALOGUES="$2"

cd "$(dirname "$0")/.."
for env_file in ./*.local.sh; do
  # shellcheck source=/dev/null
  [[ -f "$env_file" ]] && source "$env_file"
done

datagen() {
  echo "==> datagen $*"
  uv run python -m datagen "$@"
}

teacher_url="${LOCAL_TEACHER_URL:-http://127.0.0.1:8080/v1}"
wait_for_teacher() {
  until curl -sf -m 5 "$teacher_url/models" >/dev/null; do sleep 10; done
}

# generate stops when the teacher is unavailable (without counting it against any job), and each
# run gives failed jobs one more attempt (up to maxAttempts), so repeat it until nothing is left.
log="$(mktemp)"
for (( run = 1; run <= ${GENERATE_RUNS:-200}; run++ )); do
  wait_for_teacher
  if datagen generate -c "$config" --yes 2>&1 | tee "$log"; then
    grep -q "nothing to do" "$log" && break
  else
    echo "==> generate stopped (teacher unavailable?); resuming when it answers" >&2
    sleep 30
  fi
done
rm -f "$log"
# shellcheck disable=SC2086
datagen refilter -c "$config" --reparse-failed ${FILTER_ARGS:-}
until wait_for_teacher && datagen judge -c "$config"; do
  echo "==> judge stopped (teacher unavailable?); resuming when it answers" >&2
  sleep 30
done
if [[ -n "${SFT_OUT:-}" ]]; then
  datagen build-sft -c "$config" --out "$SFT_OUT"
fi
datagen stats -c "$config"
