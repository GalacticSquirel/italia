"""Teacher outages must stop a stage quickly without burning job attempts, and a dead generation
thread must restart the server. Applies on top of phase5/training efe5b68. Run from training/.
--tests-only applies just the tests (to watch them fail first)."""

import sys
from pathlib import Path


def sub(path, old, new):
    p = Path(path)
    s = p.read_text()
    assert s.count(old) == 1, (path, old[:70], s.count(old))
    p.write_text(s.replace(old, new))


# ------------------------------------------------------------------------------------- tests
sub(
    "tests/test_teacher_config.py",
    '    with pytest.raises(RuntimeError, match="giving up"):\n',
    "    # not a RuntimeError: callers must not mistake a dead teacher for a bad job\n"
    '    with pytest.raises(TeacherUnavailableError, match="giving up") as info:\n'
    "        client.complete([], temperature=0, max_tokens=1)\n"
    "    assert not isinstance(info.value, RuntimeError)\n"
    '    with pytest.raises(TeacherUnavailableError, match="giving up"):\n',
)
s = Path("tests/test_teacher_config.py").read_text()
anchor = "from datagen.teacher import"
assert s.count(anchor) == 1, "teacher import"
line = next(l for l in s.splitlines() if l.startswith(anchor))
if line.endswith("("):
    sub("tests/test_teacher_config.py", line + "\n", line + "\n    TeacherUnavailableError,\n")
else:
    sub("tests/test_teacher_config.py", line + "\n", line + "\nfrom datagen.teacher import TeacherUnavailableError\n")

sub(
    "tests/test_runner.py",
    "def test_jobs_exhausted_after_max_attempts(tmp_path: Path) -> None:",
    '''def _outage_after(n_ok: int, answer: ScriptedClient) -> tuple[ScriptedClient, dict[str, int]]:
    """A teacher that answers `n_ok` calls and then is unreachable (server down or restarting)."""
    from datagen.teacher import TeacherUnavailableError

    calls = {"n": 0}

    def respond(messages: Sequence[ChatMessage]) -> str:
        calls["n"] += 1
        if calls["n"] > n_ok:
            raise TeacherUnavailableError("teacher: giving up after 4 tries")
        return answer._responses(messages)  # type: ignore[operator]

    return ScriptedClient(respond), calls


def test_teacher_outage_stops_generate_and_keeps_finished_work(tmp_path: Path) -> None:
    """Before: the outage was either recorded as a failed attempt for every remaining job, or
    escaped the loop, after which the executor still ran (and discarded) the whole queue."""
    import pytest

    from datagen.teacher import TeacherUnavailableError

    config = make_config(tmp_path, repairAttempts=0, targetDialogues=200)
    scenarios = select_scenarios(config, load_library())
    teacher, calls = _outage_after(4, plan_aware_teacher(tmp_path))
    with pytest.raises(TeacherUnavailableError):
        run_generate(config, scenarios, teacher)
    assert calls["n"] <= 20  # 200 jobs queued: stops within a few calls of the outage
    assert len(list(read_jsonl(RunPaths(tmp_path).raw))) == 4  # finished work is kept
    assert list(read_jsonl(RunPaths(tmp_path).failed)) == []  # no attempts burned
    assert len(pending_jobs(config, scenarios)) == 196


def test_teacher_outage_stops_judge(tmp_path: Path) -> None:
    import pytest

    from datagen.jsonutil import write_jsonl
    from datagen.teacher import TeacherUnavailableError

    config = make_config(tmp_path, repairAttempts=0)
    scenarios = select_scenarios(config, load_library())
    run_generate(config, scenarios, plan_aware_teacher(tmp_path), limit=10)
    rows = list(read_jsonl(RunPaths(tmp_path).raw))
    for row in rows:
        row["filter"] = {"passed": True, "reasons": [], "metrics": {}}
    write_jsonl(RunPaths(tmp_path).filtered, rows)
    verdict = ScriptedClient(lambda m: JUDGE_OK)
    judge, calls = _outage_after(3, verdict)
    with pytest.raises(TeacherUnavailableError):
        run_judge(config, judge)
    assert calls["n"] <= 15
    assert len(list(read_jsonl(RunPaths(tmp_path).judged))) == 3


def test_jobs_exhausted_after_max_attempts(tmp_path: Path) -> None:''',
)

sub(
    "tests/test_mlx_server.py",
    "from datagen import mlx_server  # noqa: E402\n",
    '''from datagen import mlx_server  # noqa: E402


class _FakeGenerator:
    def __init__(self, fail: bool) -> None:
        self.fail = fail
        self._generation_failed = False

    def _run_generate(self) -> None:  # stands in for mlx_lm's: logs and sets the flag
        if self.fail:
            self._generation_failed = True


def test_dead_generation_thread_exits_the_process(monkeypatch: pytest.MonkeyPatch) -> None:
    exits: list[int] = []
    monkeypatch.setattr(mlx_server.os, "_exit", exits.append)
    run = mlx_server.exit_when_generation_dies(_FakeGenerator._run_generate)
    run(_FakeGenerator(fail=False))  # a clean stop does not exit
    assert exits == []
    run(_FakeGenerator(fail=True))  # mlx-lm would otherwise answer 404 forever
    assert exits == [mlx_server.EXIT_GENERATION_DIED]
''',
)

if "--tests-only" in sys.argv:
    print("tests applied")
    sys.exit(0)

# ----------------------------------------------------------------------------------- teacher
sub(
    "datagen/teacher.py",
    "class RetryableError(RuntimeError):\n    pass\n",
    "class RetryableError(RuntimeError):\n    pass\n\n\n"
    "class TeacherUnavailableError(Exception):\n"
    '    """The endpoint kept failing (down, restarting, overloaded) after every retry.\n\n'
    "    Deliberately not a RuntimeError: the pipeline counts RuntimeError against the job, while\n"
    '    this says nothing about the job and stops the stage instead (see datagen.runner)."""\n',
)
sub(
    "datagen/teacher.py",
    '                    raise RuntimeError(f"{self.name}: giving up after {attempt} tries") from err\n',
    '                    raise TeacherUnavailableError(\n'
    '                        f"{self.name}: giving up after {attempt} tries"\n'
    "                    ) from err\n",
)

# ------------------------------------------------------------------------------------ runner
sub(
    "datagen/runner.py",
    "from concurrent.futures import ThreadPoolExecutor, as_completed\n",
    "from concurrent.futures import CancelledError, Future, ThreadPoolExecutor, as_completed\n",
)
sub(
    "datagen/runner.py",
    "def pending_jobs(",
    '''class _Outage:
    """Stops a teacher-bound stage on the first error that is not about the item itself.

    Leaving a `with ThreadPoolExecutor` block on an exception waits for every queued item to run,
    and their results are lost, so a dead teacher used to burn hours of queue. Instead the queue
    is cancelled, items already in flight are still collected, and the error is re-raised after.
    """

    def __init__(self, futures: Iterable[Future[object]]) -> None:
        self._futures = list(futures)
        self.error: Exception | None = None

    def record(self, err: Exception) -> None:
        if self.error is None:
            self.error = err
            cancelled = sum(f.cancel() for f in self._futures)
            log.error("teacher unavailable, stopping (%d queued items cancelled): %s", cancelled, err)

    def reraise(self) -> None:
        if self.error is not None:
            raise self.error


def pending_jobs(''',
)
sub(
    "datagen/runner.py",
    "            for job in jobs\n"
    "        }\n"
    "        for future in as_completed(futures):\n"
    "            job = futures[future]\n"
    "            try:\n"
    "                record = future.result()\n"
    "            except (SynthesisError, RuntimeError, ValueError) as err:\n",
    "            for job in jobs\n"
    "        }\n"
    "        outage = _Outage(futures)  # type: ignore[arg-type]\n"
    "        for future in as_completed(futures):\n"
    "            job = futures[future]\n"
    "            try:\n"
    "                record = future.result()\n"
    "            except CancelledError:\n"
    "                continue\n"
    "            except (SynthesisError, RuntimeError, ValueError) as err:\n",
)
sub(
    "datagen/runner.py",
    '                log.warning("job %s failed: %s", job.id, err)\n'
    "            else:\n"
    "                ok += 1\n"
    "                raw.append(record.to_wire())\n"
    "            if progress:\n"
    "                progress(ok + failed, len(jobs))\n",
    '                log.warning("job %s failed: %s", job.id, err)\n'
    "            except Exception as err:  # the teacher, not the job: stop without burning attempts\n"
    "                outage.record(err)\n"
    "                continue\n"
    "            else:\n"
    "                ok += 1\n"
    "                raw.append(record.to_wire())\n"
    "            if progress:\n"
    "                progress(ok + failed, len(jobs))\n"
    "    outage.reraise()\n",
)
sub(
    "datagen/runner.py",
    "            for r in todo\n"
    "        }\n"
    "        for future in as_completed(futures):\n"
    "            record = futures[future]\n"
    "            try:\n"
    "                result, _usage = future.result()\n"
    "            except (JudgeParseError, RuntimeError) as err:\n"
    "                bad += 1\n"
    '                log.warning("judge failed for %s: %s", record.id, err)\n'
    "                continue\n"
    "            ok += 1\n"
    "            out.append(record.model_copy(update={\"judge\": result}).to_wire())\n"
    "    return ok, bad\n",
    "            for r in todo\n"
    "        }\n"
    "        outage = _Outage(futures)  # type: ignore[arg-type]\n"
    "        for future in as_completed(futures):\n"
    "            record = futures[future]\n"
    "            try:\n"
    "                result, _usage = future.result()\n"
    "            except CancelledError:\n"
    "                continue\n"
    "            except (JudgeParseError, RuntimeError) as err:\n"
    "                bad += 1\n"
    '                log.warning("judge failed for %s: %s", record.id, err)\n'
    "                continue\n"
    "            except Exception as err:  # the judge endpoint, not the dialogue\n"
    "                outage.record(err)\n"
    "                continue\n"
    "            ok += 1\n"
    "            out.append(record.model_copy(update={\"judge\": result}).to_wire())\n"
    "    outage.reraise()\n"
    "    return ok, bad\n",
)

# -------------------------------------------------------------------------------- mlx_server
sub(
    "datagen/mlx_server.py",
    "import sys\n",
    "import logging\nimport os\nimport sys\nfrom collections.abc import Callable\n",
)
sub(
    "datagen/mlx_server.py",
    'def main(argv: list[str] | None = None) -> None:\n'
    '    """Patch mlx-lm, then run ``mlx_lm.server`` with the given arguments."""\n'
    "    patch_arrays_cache()\n",
    '''# Exit status when mlx-lm's generation thread has died; scripts/serve-teacher.sh restarts on it.
EXIT_GENERATION_DIED = 75  # EX_TEMPFAIL


def exit_when_generation_dies(run_generate: Callable[[Any], None]) -> Callable[[Any], None]:
    """Wrap ``ResponseGenerator._run_generate`` so a dead generation thread ends the process.

    mlx-lm logs the error and keeps the HTTP server up, answering every completion with 404
    (ml-explore/mlx-lm issue 1505), so nothing restarts it. A rare Metal out-of-memory during
    prefill is enough. Exiting lets the supervisor restart a working server.
    """

    def run(self: Any) -> None:
        run_generate(self)
        if getattr(self, "_generation_failed", False):
            logging.critical("generation thread died; exiting so the server can be restarted")
            os._exit(EXIT_GENERATION_DIED)

    return run


def main(argv: list[str] | None = None) -> None:
    """Patch mlx-lm, then run ``mlx_lm.server`` with the given arguments."""
    patch_arrays_cache()
    generator = server.ResponseGenerator
    if not getattr(generator, "_italia_exit_on_death", False):
        generator._run_generate = exit_when_generation_dies(generator._run_generate)  # type: ignore[method-assign]
        generator._italia_exit_on_death = True  # type: ignore[attr-defined]
''',
)

# ------------------------------------------------------------------------------------ scripts
sub(
    "scripts/serve-teacher.sh",
    "exec uv run --extra mlx python -m datagen.mlx_server --model \"$model\" \\\n"
    "  --host \"${LOCAL_TEACHER_HOST:-127.0.0.1}\" --port \"${LOCAL_TEACHER_PORT:-8080}\" \\\n"
    "  --decode-concurrency \"${DECODE_CONCURRENCY:-8}\" \\\n"
    "  --prompt-concurrency \"${PROMPT_CONCURRENCY:-$prompt_default}\" \\\n"
    "  --prompt-cache-bytes \"${PROMPT_CACHE_BYTES:-$cache_default}\"\n",
    "# datagen.mlx_server exits with 75 when mlx-lm's generation thread dies (e.g. a rare Metal\n"
    "# out-of-memory during prefill); start it again. Any other exit ends the script.\n"
    "while true; do\n"
    "  status=0\n"
    "  uv run --extra mlx python -m datagen.mlx_server --model \"$model\" \\\n"
    "    --host \"${LOCAL_TEACHER_HOST:-127.0.0.1}\" --port \"${LOCAL_TEACHER_PORT:-8080}\" \\\n"
    "    --decode-concurrency \"${DECODE_CONCURRENCY:-8}\" \\\n"
    "    --prompt-concurrency \"${PROMPT_CONCURRENCY:-$prompt_default}\" \\\n"
    "    --prompt-cache-bytes \"${PROMPT_CACHE_BYTES:-$cache_default}\" || status=$?\n"
    "  if (( status != 75 )); then\n"
    "    exit \"$status\"\n"
    "  fi\n"
    "  echo \"==> $(date '+%F %T') teacher generation thread died; restarting\" >&2\n"
    "  sleep 5\n"
    "done\n",
)
sub(
    "scripts/run-round.sh",
    'datagen generate -c "$config" --yes\n'
    "# shellcheck disable=SC2086\n"
    'datagen refilter -c "$config" --reparse-failed ${FILTER_ARGS:-}\n'
    'datagen judge -c "$config"\n',
    '''teacher_url="${LOCAL_TEACHER_URL:-http://127.0.0.1:8080/v1}"
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
''',
)
print("patched")
