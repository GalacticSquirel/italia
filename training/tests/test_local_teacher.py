"""Self-hosted teacher: wall-clock estimates, the throughput bench and the local Mac config."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import pytest

from datagen.bench import measure, yaml_block
from datagen.config import load_config
from datagen.cost import estimate_cost
from datagen.learner import build_jobs
from datagen.teacher import Completion, Throughput, Usage
from spec.render import ChatMessage
from spec.scenarios import load_library
from tests.helpers import make_config

ROOT = Path(__file__).resolve().parents[1]


def test_cost_estimate_reports_hours_for_a_local_teacher(tmp_path: Path) -> None:
    library = load_library()
    scenarios = [s for s in library.values() if s.split == "train"]
    local = {
        "protocol": "openai",
        "baseUrl": "http://127.0.0.1:8080/v1",
        "model": "local",
        "throughput": {"promptTokensPerSec": 400, "generationTokensPerSec": 100},
    }
    config = make_config(tmp_path, targetDialogues=500, teacher=local, revisePass=True)
    jobs = build_jobs(config, scenarios)
    est = estimate_cost(config, jobs, library, sample_size=40)
    assert est.total_cost == 0
    gen = est.stages[0]
    expected = (gen.usage.input_tokens / 400 + gen.usage.output_tokens / 100) / 3600
    assert gen.hours == pytest.approx(expected)
    assert est.total_hours == pytest.approx(sum(s.hours or 0 for s in est.stages))
    assert "hours" in est.table() and "wall clock" in est.table()
    paid = estimate_cost(make_config(tmp_path, targetDialogues=500), jobs, library, sample_size=40)
    assert paid.total_hours is None and "hours" not in paid.table()


def test_local_mac_config(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in list(os.environ):
        if name.startswith(("LOCAL_", "TARGET_", "REVISE")):
            monkeypatch.delenv(name)
    config = load_config(ROOT / "datagen" / "configs" / "local-mac.yaml")
    assert config.target_dialogues == 10_000 and config.revise_pass is True
    assert config.teacher.api_key_env is None and config.teacher.pricing.input_per_mtok == 0
    assert config.teacher.base_url == "http://127.0.0.1:8080/v1"
    assert config.teacher.throughput is not None
    assert config.judge_endpoint.model == config.teacher.model
    assert config.teacher.extra_body == {"chat_template_kwargs": {"enable_thinking": False}}
    monkeypatch.setenv("TARGET_DIALOGUES", "57000")
    monkeypatch.setenv("REVISE", "false")
    monkeypatch.setenv("LOCAL_TEACHER_MODEL", "other/model")
    bigger = load_config(ROOT / "datagen" / "configs" / "local-mac.yaml")
    assert bigger.target_dialogues == 57_000 and bigger.revise_pass is False
    assert bigger.judge_endpoint.model == "other/model"
    # Round 1 is a prefix of round 2, so the bigger run resumes the smaller one.
    scenarios = [s for s in load_library().values() if s.split == "train"]
    small_jobs = build_jobs(config, scenarios)
    assert [j.id for j in build_jobs(bigger, scenarios)[:10_000]] == [j.id for j in small_jobs]


class _TimedClient:
    """Fake server: every call takes one clock tick and reports fixed usage."""

    def __init__(self, clock: list[float]) -> None:
        self.clock = clock

    @property
    def name(self) -> str:
        return "fake"

    def complete(
        self,
        messages: Any,
        *,
        temperature: float,
        max_tokens: int,
        json_output: bool = False,
    ) -> Completion:
        del messages, temperature, json_output
        self.clock[0] += 1.0
        out = 1 if max_tokens == 1 else 200
        return Completion("x", Usage(input_tokens=1000, output_tokens=out), "fake")


def test_bench_measures_aggregate_throughput() -> None:
    clock = [0.0]
    client = _TimedClient(clock)
    briefs: list[list[ChatMessage]] = [[{"role": "user", "content": "b"}]]
    throughput, prefill, decode_probe = measure(
        client, briefs, concurrency=1, rounds=2, clock=lambda: clock[0]
    )
    assert prefill.requests == 2 and prefill.seconds == 2.0
    assert throughput.prompt_tokens_per_sec == 1000  # 2000 tokens / 2 s
    assert throughput.generation_tokens_per_sec == 200
    assert decode_probe.usage.output_tokens == 400
    assert "promptTokensPerSec: 1000" in yaml_block(throughput)
    assert Throughput(prompt_tokens_per_sec=1, generation_tokens_per_sec=1).hours(
        Usage(input_tokens=1800, output_tokens=1800)
    ) == pytest.approx(1.0)
