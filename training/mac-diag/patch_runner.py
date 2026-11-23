"""Stop generate promptly on a teacher/infrastructure error instead of silently running (and
discarding) every queued job. Run from training/. --tests-only applies just the test."""

import sys
from pathlib import Path


def sub(path, old, new):
    p = Path(path)
    s = p.read_text()
    assert s.count(old) == 1, (path, old[:70], s.count(old))
    p.write_text(s.replace(old, new))


sub(
    "tests/test_runner.py",
    "def test_jobs_exhausted_after_max_attempts(tmp_path: Path) -> None:",
    '''def test_teacher_outage_stops_generate_and_keeps_finished_work(tmp_path: Path) -> None:
    """A teacher error (e.g. mlx_lm.server answering 404 after its generation thread died) must
    not burn job attempts, and must not keep running and discarding the rest of the queue."""
    import httpx
    import pytest

    config = make_config(tmp_path, draftRepairs=0)
    scenarios = select_scenarios(config, load_library())
    good = plan_aware_teacher(tmp_path)
    calls = {"n": 0}

    def respond(messages: Sequence[ChatMessage]) -> str:
        calls["n"] += 1
        if calls["n"] >= 5:
            request = httpx.Request("POST", "http://teacher.invalid/v1/chat/completions")
            raise httpx.HTTPStatusError(
                "404", request=request, response=httpx.Response(404, request=request)
            )
        return good._responses(messages)  # type: ignore[operator]

    with pytest.raises(httpx.HTTPStatusError):
        run_generate(config, scenarios, ScriptedClient(respond))
    # 20 jobs, 2 in flight: stops right after the outage instead of calling for every job
    assert calls["n"] <= 4 + config.teacher.max_concurrency
    raw = list(read_jsonl(RunPaths(tmp_path).raw))
    assert len(raw) == 4  # finished work before the outage is kept
    assert list(read_jsonl(RunPaths(tmp_path).failed)) == []  # no attempts burned
    assert len(pending_jobs(config, scenarios)) == 16


def test_jobs_exhausted_after_max_attempts(tmp_path: Path) -> None:''',
)

if "--tests-only" in sys.argv:
    print("test applied")
    sys.exit(0)

sub(
    "datagen/runner.py",
    "from concurrent.futures import ThreadPoolExecutor, as_completed\n",
    "from concurrent.futures import CancelledError, ThreadPoolExecutor, as_completed\n",
)
sub(
    "datagen/runner.py",
    "    ok = failed = 0\n"
    "    with (\n"
    "        JsonlAppender(paths.raw) as raw,\n",
    "    ok = failed = 0\n"
    "    outage: Exception | None = None\n"
    "    with (\n"
    "        JsonlAppender(paths.raw) as raw,\n",
)
sub(
    "datagen/runner.py",
    "            try:\n"
    "                record = future.result()\n"
    "            except (SynthesisError, RuntimeError, ValueError) as err:\n"
    "                failed += 1\n"
    "                failures.append({\"id\": job.id, \"error\": str(err)[:500]})\n"
    "                log.warning(\"job %s failed: %s\", job.id, err)\n"
    "            else:\n",
    "            try:\n"
    "                record = future.result()\n"
    "            except CancelledError:\n"
    "                continue\n"
    "            except (SynthesisError, RuntimeError, ValueError) as err:\n"
    "                failed += 1\n"
    "                failures.append({\"id\": job.id, \"error\": str(err)[:500]})\n"
    "                log.warning(\"job %s failed: %s\", job.id, err)\n"
    "            except Exception as err:  # teacher unreachable or erroring: not the job's fault\n"
    "                # Without this, leaving the `with` block would wait for every queued job to\n"
    "                # run and then discard its result. Cancel the queue, keep what is in flight,\n"
    "                # and re-raise so the caller can wait for the teacher and resume.\n"
    "                if outage is None:\n"
    "                    outage = err\n"
    "                    cancelled = sum(f.cancel() for f in futures)\n"
    "                    log.error(\n"
    "                        \"teacher error, stopping (%d queued jobs cancelled): %s\", cancelled, err\n"
    "                    )\n"
    "                continue\n"
    "            else:\n",
)
sub(
    "datagen/runner.py",
    "            if progress:\n"
    "                progress(ok + failed, len(jobs))\n"
    "    return ok, failed\n",
    "            if progress:\n"
    "                progress(ok + failed, len(jobs))\n"
    "    if outage is not None:\n"
    "        raise outage\n"
    "    return ok, failed\n",
)
print("patched")
