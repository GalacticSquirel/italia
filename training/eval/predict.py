"""Run a system under test over evaluation items (resumable).

Any model is reached through the OpenAI-compatible or Anthropic-compatible protocol: serve the
GGUF with llama.cpp's `llama-server`, an HF checkpoint with vLLM, or point at the teacher.
With `constrained: true` the request carries the output JSON Schema, which llama-server turns
into a grammar exactly like llama.rn does on the phone.
"""

from __future__ import annotations

import time
from collections.abc import Callable, Sequence
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Literal, Protocol, cast

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from datagen.config import expand_env, load_raw
from datagen.jsonutil import JsonlAppender, read_jsonl
from datagen.teacher import ChatClient, ModelEndpoint, make_client
from eval.items import EvalItem
from spec.models import output_json_schema
from spec.render import ChatMessage
from train.tokenize import merge_system_message


class SystemSpec(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")

    name: str
    endpoint: ModelEndpoint
    constrained: bool = False
    system_role: Literal["native", "merge"] = "native"
    temperature: float = 0.0
    max_tokens: int = 400


def load_systems(path: Path) -> dict[str, SystemSpec]:
    raw = expand_env(load_raw(path))
    assert isinstance(raw, dict)
    systems = [SystemSpec.model_validate(s) for s in raw["systems"]]
    return {s.name: s for s in systems}


def request_endpoint(spec: SystemSpec) -> ModelEndpoint:
    if not spec.constrained:
        return spec.endpoint
    schema_format = {
        "type": "json_schema",
        "json_schema": {"name": "tutor_output", "strict": True, "schema": output_json_schema()},
    }
    extra = {**spec.endpoint.extra_body, "response_format": schema_format}
    return spec.endpoint.model_copy(update={"extra_body": extra})


class PromptItem(Protocol):
    """What a system is run on: benchmark items and real-learner items both qualify."""

    @property
    def id(self) -> str: ...

    @property
    def messages(self) -> list[dict[str, str]]: ...


def to_messages(item: PromptItem, spec: SystemSpec) -> list[ChatMessage]:
    messages = item.messages
    if spec.system_role == "merge":
        messages = merge_system_message(messages)
    out: list[ChatMessage] = []
    for m in messages:
        role = m["role"]
        if role not in ("system", "user", "assistant"):
            raise ValueError(f"unexpected role {role}")
        out.append(cast(ChatMessage, {"role": role, "content": m["content"]}))
    return out


def predict(
    spec: SystemSpec,
    items: Sequence[PromptItem],
    out_path: Path,
    *,
    client: ChatClient | None = None,
    clock: Callable[[], float] = time.perf_counter,
) -> int:
    """Write {"itemId", "system", "text", "latencyMs"} rows; returns how many were added."""
    done = {r["itemId"] for r in read_jsonl(out_path) if r.get("system") == spec.name}
    todo = [i for i in items if i.id not in done]
    chat = client or make_client(request_endpoint(spec))

    def one(item: PromptItem) -> dict[str, object]:
        start = clock()
        completion = chat.complete(
            to_messages(item, spec),
            temperature=spec.temperature,
            max_tokens=spec.max_tokens,
            json_output=not spec.constrained,
        )
        return {
            "itemId": item.id,
            "system": spec.name,
            "text": completion.text.strip(),
            "latencyMs": round(1000 * (clock() - start), 1),
        }

    with (
        JsonlAppender(out_path) as out,
        ThreadPoolExecutor(max_workers=spec.endpoint.max_concurrency) as pool,
    ):
        futures = [pool.submit(one, item) for item in todo]
        for future in as_completed(futures):
            out.append(future.result())
    return len(todo)


def reference_predictions(items: Sequence[EvalItem]) -> dict[str, str]:
    """The teacher's own turns, scored as a system (the ceiling the student is compared with)."""
    return {i.id: i.reference for i in items}


def load_predictions(path: Path, system: str) -> dict[str, str]:
    return {str(r["itemId"]): str(r["text"]) for r in read_jsonl(path) if r.get("system") == system}
