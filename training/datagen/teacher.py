"""Teacher-agnostic chat-completion clients.

Two wire protocols cover practically every large-model provider and self-hosted server:

- `openai`: `POST {baseUrl}/chat/completions` (also vLLM, llama.cpp's llama-server, SGLang, ...)
- `anthropic`: `POST {baseUrl}/v1/messages`

Which provider and model act as teacher or judge is configuration only. API keys are read from the
environment variable named in the config and never written anywhere.
"""

from __future__ import annotations

import os
import random
import time
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Literal, Protocol

import httpx
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from spec.render import ChatMessage


class Usage(BaseModel):
    model_config = ConfigDict(frozen=True)

    input_tokens: int = 0
    output_tokens: int = 0

    def __add__(self, other: Usage) -> Usage:
        return Usage(
            input_tokens=self.input_tokens + other.input_tokens,
            output_tokens=self.output_tokens + other.output_tokens,
        )


@dataclass(frozen=True)
class Completion:
    text: str
    usage: Usage
    model: str


class ChatClient(Protocol):
    """Anything that turns chat messages into one completion."""

    @property
    def name(self) -> str: ...

    def complete(
        self,
        messages: Sequence[ChatMessage],
        *,
        temperature: float,
        max_tokens: int,
        json_output: bool = False,
    ) -> Completion: ...


class Pricing(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")

    input_per_mtok: float = Field(ge=0, description="USD per million input tokens")
    output_per_mtok: float = Field(ge=0, description="USD per million output tokens")

    def cost(self, usage: Usage) -> float:
        return (
            usage.input_tokens * self.input_per_mtok + usage.output_tokens * self.output_per_mtok
        ) / 1_000_000


class ModelEndpoint(BaseModel):
    """Configuration of one model endpoint (teacher, judge, or a model under evaluation)."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")

    protocol: Literal["openai", "anthropic"]
    base_url: str
    model: str
    api_key_env: str | None = Field(
        default=None, description="Name of the environment variable that holds the API key."
    )
    pricing: Pricing = Pricing(input_per_mtok=0, output_per_mtok=0)
    max_concurrency: int = Field(default=8, ge=1)
    timeout_s: float = Field(default=300, gt=0)
    max_retries: int = Field(default=6, ge=0)
    extra_body: dict[str, object] = Field(
        default_factory=dict, description="Provider-specific request fields, passed through."
    )


class RetryableError(RuntimeError):
    pass


_RETRY_STATUS = frozenset({408, 409, 429, 500, 502, 503, 504, 529})


class _HttpClient:
    def __init__(
        self,
        endpoint: ModelEndpoint,
        *,
        http: httpx.Client | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self.endpoint = endpoint
        self._http = http or httpx.Client(timeout=endpoint.timeout_s)
        self._sleep = sleep

    @property
    def name(self) -> str:
        return f"{self.endpoint.protocol}:{self.endpoint.model}"

    def _api_key(self) -> str | None:
        env = self.endpoint.api_key_env
        if env is None:
            return None
        key = os.environ.get(env)
        if not key:
            raise RuntimeError(f"environment variable {env} is not set")
        return key

    def _post(self, url: str, headers: dict[str, str], body: dict[str, object]) -> object:
        attempt = 0
        while True:
            try:
                response = self._http.post(url, headers=headers, json=body)
                if response.status_code in _RETRY_STATUS:
                    raise RetryableError(f"HTTP {response.status_code}: {response.text[:200]}")
                response.raise_for_status()
                return response.json()
            except (RetryableError, httpx.TransportError) as err:
                attempt += 1
                if attempt > self.endpoint.max_retries:
                    raise RuntimeError(f"{self.name}: giving up after {attempt} tries") from err
                self._sleep(min(60.0, 2.0**attempt) * (0.5 + random.random()))


class OpenAICompatibleClient(_HttpClient):
    def complete(
        self,
        messages: Sequence[ChatMessage],
        *,
        temperature: float,
        max_tokens: int,
        json_output: bool = False,
    ) -> Completion:
        headers = {"content-type": "application/json"}
        key = self._api_key()
        if key:
            headers["authorization"] = f"Bearer {key}"
        body: dict[str, object] = {
            "model": self.endpoint.model,
            "messages": list(messages),
            "temperature": temperature,
            "max_tokens": max_tokens,
            **self.endpoint.extra_body,
        }
        if json_output:
            body["response_format"] = {"type": "json_object"}
        data = self._post(self.endpoint.base_url.rstrip("/") + "/chat/completions", headers, body)
        return parse_openai_response(data)


class AnthropicCompatibleClient(_HttpClient):
    API_VERSION = "2023-06-01"

    def complete(
        self,
        messages: Sequence[ChatMessage],
        *,
        temperature: float,
        max_tokens: int,
        json_output: bool = False,
    ) -> Completion:
        del json_output  # this protocol has no JSON mode; prompts ask for JSON explicitly
        headers = {"content-type": "application/json", "anthropic-version": self.API_VERSION}
        key = self._api_key()
        if key:
            headers["x-api-key"] = key
        system = "\n\n".join(m["content"] for m in messages if m["role"] == "system")
        chat = [
            {"role": m["role"], "content": m["content"]} for m in messages if m["role"] != "system"
        ]
        body: dict[str, object] = {
            "model": self.endpoint.model,
            "messages": chat,
            "temperature": temperature,
            "max_tokens": max_tokens,
            **self.endpoint.extra_body,
        }
        if system:
            body["system"] = system
        data = self._post(self.endpoint.base_url.rstrip("/") + "/v1/messages", headers, body)
        return parse_anthropic_response(data)


def parse_openai_response(data: object) -> Completion:
    if not isinstance(data, dict):
        raise ValueError("unexpected response shape")
    choices = data.get("choices") or []
    if not choices:
        raise ValueError("response has no choices")
    text = choices[0].get("message", {}).get("content") or ""
    usage = data.get("usage") or {}
    return Completion(
        text=str(text),
        usage=Usage(
            input_tokens=int(usage.get("prompt_tokens", 0)),
            output_tokens=int(usage.get("completion_tokens", 0)),
        ),
        model=str(data.get("model", "")),
    )


def parse_anthropic_response(data: object) -> Completion:
    if not isinstance(data, dict):
        raise ValueError("unexpected response shape")
    blocks = data.get("content") or []
    text = "".join(str(b.get("text", "")) for b in blocks if b.get("type") == "text")
    usage = data.get("usage") or {}
    return Completion(
        text=text,
        usage=Usage(
            input_tokens=int(usage.get("input_tokens", 0)),
            output_tokens=int(usage.get("output_tokens", 0)),
        ),
        model=str(data.get("model", "")),
    )


def make_client(endpoint: ModelEndpoint, *, http: httpx.Client | None = None) -> ChatClient:
    if endpoint.protocol == "openai":
        return OpenAICompatibleClient(endpoint, http=http)
    return AnthropicCompatibleClient(endpoint, http=http)


class ScriptedClient:
    """Returns canned completions in order (tests and `--dry-run`)."""

    def __init__(self, responses: Sequence[str] | Callable[[Sequence[ChatMessage]], str]) -> None:
        self._responses = responses
        self._index = 0
        self.calls: list[list[ChatMessage]] = []

    @property
    def name(self) -> str:
        return "scripted"

    def complete(
        self,
        messages: Sequence[ChatMessage],
        *,
        temperature: float,
        max_tokens: int,
        json_output: bool = False,
    ) -> Completion:
        del temperature, max_tokens, json_output
        self.calls.append(list(messages))
        if callable(self._responses):
            text = self._responses(messages)
        else:
            text = self._responses[self._index % len(self._responses)]
            self._index += 1
        chars_in = sum(len(m["content"]) for m in messages)
        return Completion(
            text=text,
            usage=Usage(input_tokens=chars_in // 4, output_tokens=len(text) // 4),
            model="scripted",
        )
