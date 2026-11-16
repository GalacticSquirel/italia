from __future__ import annotations

import json
from pathlib import Path

import httpx
import pytest

from datagen.config import expand_env, load_config
from datagen.languagetool import (
    LanguageToolClient,
    NullChecker,
    errors_per_100_words,
    parse_matches,
)
from datagen.teacher import (
    AnthropicCompatibleClient,
    ModelEndpoint,
    OpenAICompatibleClient,
    Pricing,
    ScriptedClient,
    TeacherUnavailableError,
    Usage,
    make_client,
)


def endpoint(protocol: str, **extra: object) -> ModelEndpoint:
    return ModelEndpoint.model_validate(
        {
            "protocol": protocol,
            "baseUrl": "https://api.example",
            "model": "m",
            "apiKeyEnv": "TEST_KEY",
            **extra,
        }
    )


def test_openai_adapter_sends_bearer_key_and_parses(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TEST_KEY", "sekret")
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(
            200,
            json={
                "model": "m",
                "choices": [{"message": {"content": '{"a":1}'}}],
                "usage": {"prompt_tokens": 10, "completion_tokens": 3},
            },
        )

    client = OpenAICompatibleClient(
        endpoint("openai"), http=httpx.Client(transport=httpx.MockTransport(handler))
    )
    result = client.complete(
        [{"role": "user", "content": "hi"}], temperature=0.1, max_tokens=5, json_output=True
    )
    assert result.text == '{"a":1}'
    assert result.usage == Usage(input_tokens=10, output_tokens=3)
    request = seen[0]
    assert str(request.url) == "https://api.example/chat/completions"
    assert request.headers["authorization"] == "Bearer sekret"
    body = json.loads(request.content)
    assert body["response_format"] == {"type": "json_object"}
    assert "sekret" not in request.content.decode()


def test_anthropic_adapter_moves_system_out(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TEST_KEY", "k2")
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(
            200,
            json={
                "model": "m",
                "content": [{"type": "text", "text": "ciao"}],
                "usage": {"input_tokens": 7, "output_tokens": 2},
            },
        )

    client = AnthropicCompatibleClient(
        endpoint("anthropic"), http=httpx.Client(transport=httpx.MockTransport(handler))
    )
    result = client.complete(
        [{"role": "system", "content": "be brief"}, {"role": "user", "content": "hi"}],
        temperature=0,
        max_tokens=5,
    )
    assert result.text == "ciao" and result.usage.input_tokens == 7
    request = seen[0]
    assert str(request.url) == "https://api.example/v1/messages"
    assert request.headers["x-api-key"] == "k2"
    body = json.loads(request.content)
    assert body["system"] == "be brief"
    assert body["messages"] == [{"role": "user", "content": "hi"}]


def test_retries_then_succeeds(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TEST_KEY", "k")
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] < 3:
            return httpx.Response(429, text="slow down")
        return httpx.Response(200, json={"choices": [{"message": {"content": "ok"}}]})

    sleeps: list[float] = []
    client = OpenAICompatibleClient(
        endpoint("openai"),
        http=httpx.Client(transport=httpx.MockTransport(handler)),
        sleep=sleeps.append,
    )
    assert client.complete([], temperature=0, max_tokens=1).text == "ok"
    assert calls["n"] == 3 and len(sleeps) == 2


def test_gives_up_after_max_retries(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TEST_KEY", "k")
    transport = httpx.MockTransport(lambda r: httpx.Response(503))
    client = OpenAICompatibleClient(
        endpoint("openai", maxRetries=1),
        http=httpx.Client(transport=transport),
        sleep=lambda s: None,
    )
    # not a RuntimeError: callers must not mistake a dead teacher for a bad job
    with pytest.raises(TeacherUnavailableError, match="giving up") as info:
        client.complete([], temperature=0, max_tokens=1)
    assert not isinstance(info.value, RuntimeError)
    with pytest.raises(TeacherUnavailableError, match="giving up"):
        client.complete([], temperature=0, max_tokens=1)


def test_missing_key_is_an_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("TEST_KEY", raising=False)
    client = make_client(endpoint("openai"))
    with pytest.raises(RuntimeError, match="TEST_KEY"):
        client.complete([], temperature=0, max_tokens=1)


def test_pricing_and_scripted_client() -> None:
    assert Pricing(input_per_mtok=3, output_per_mtok=15).cost(
        Usage(input_tokens=1_000_000, output_tokens=100_000)
    ) == pytest.approx(4.5)
    scripted = ScriptedClient(["a", "b"])
    assert [scripted.complete([], temperature=0, max_tokens=1).text for _ in range(3)] == [
        "a",
        "b",
        "a",
    ]


def test_expand_env_nested(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("B", "bee")
    monkeypatch.delenv("A", raising=False)
    assert expand_env({"x": ["${A:-${B}}", "${A:-plain}"]}) == {"x": ["bee", "plain"]}
    monkeypatch.delenv("B")
    with pytest.raises(KeyError, match="B"):
        expand_env("${B}")


def test_config_extends_and_resolves_paths(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("URL", "https://t")
    (tmp_path / "base.yaml").write_text(
        "name: base\noutputDir: work/x\ntargetDialogues: 10\n"
        "teacher: {protocol: openai, baseUrl: '${URL}', model: m}\n"
        "learner: {secondErrorRate: 0.2}\n"
    )
    (tmp_path / "child.yaml").write_text(
        "extends: base.yaml\nname: child\nlearner: {focusBoost: 5}\n"
    )
    config = load_config(tmp_path / "child.yaml")
    assert config.name == "child" and config.teacher.base_url == "https://t"
    assert config.learner.second_error_rate == 0.2 and config.learner.focus_boost == 5
    assert config.output_dir.is_absolute() and config.output_dir.parts[-2:] == ("work", "x")
    assert config.judge_endpoint == config.teacher


def test_shipped_configs_load(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TEACHER_BASE_URL", "https://t")
    monkeypatch.setenv("TEACHER_MODEL", "m")
    root = Path(__file__).resolve().parents[1] / "datagen" / "configs"
    names = {p.name: load_config(p) for p in root.glob("*.yaml")}
    assert {"train.yaml", "eval.yaml", "pilot.yaml"} <= set(names)
    assert names["eval.yaml"].split == "eval"
    assert 30_000 <= names["train.yaml"].target_dialogues * 0.7 <= 60_000


LT_RESPONSE = {
    "matches": [
        {
            "message": "Accordo",
            "offset": 3,
            "length": 4,
            "rule": {"id": "IT_AGREEMENT", "category": {"id": "GRAMMAR"}},
        },
        {
            "message": "spazio",
            "offset": 0,
            "length": 1,
            "rule": {"id": "WHITESPACE_RULE", "category": {"id": "TYPOGRAPHY"}},
        },
    ]
}


def test_languagetool_parsing_and_client() -> None:
    matches = parse_matches(LT_RESPONSE)
    assert [m.rule_id for m in matches] == ["IT_AGREEMENT"]
    assert matches[0].span("La casa rossi") == "casa"
    posted: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        posted.append(request)
        return httpx.Response(200, json=LT_RESPONSE)

    client = LanguageToolClient(
        "http://lt/v2/", client=httpx.Client(transport=httpx.MockTransport(handler))
    )
    assert len(client.check("La casa rossi")) == 1
    assert len(client.check("La casa rossi")) == 1  # cached
    assert len(posted) == 1
    assert str(posted[0].url) == "http://lt/v2/check"
    assert b"language=it" in posted[0].content
    assert errors_per_100_words(client, ["La casa rossi"]) == pytest.approx(100 / 3)
    assert errors_per_100_words(NullChecker(), ["x"]) == 0
    assert errors_per_100_words(NullChecker(), []) == 0
