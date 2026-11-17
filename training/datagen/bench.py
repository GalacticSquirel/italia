"""Measure a self-hosted teacher's throughput, so the estimator can predict wall-clock hours.

Two probes against the configured endpoint, each with `maxConcurrency` requests in flight:

1. prefill: real dialogue briefs with `max_tokens=1` -> prompt tokens per second
2. decode: a short prompt with a long answer -> generated tokens per second

Both are aggregates over all concurrent requests, which is what a long run sees. Paste the printed
`throughput:` block under `teacher:` (and `judge.endpoint:` when it is the same server).
"""

from __future__ import annotations

import time
from collections.abc import Callable, Sequence
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

from datagen.teacher import ChatClient, Throughput, Usage
from spec.render import ChatMessage

DECODE_PROMPT: list[ChatMessage] = [
    {
        "role": "user",
        "content": "Scrivi un dialogo lungo e naturale, in italiano semplice, tra un barista e "
        "un cliente che ordina la colazione. Almeno trenta battute.",
    }
]


@dataclass(frozen=True)
class Probe:
    requests: int
    usage: Usage
    seconds: float


def run_probe(
    client: ChatClient,
    conversations: Sequence[Sequence[ChatMessage]],
    *,
    max_tokens: int,
    concurrency: int,
    clock: Callable[[], float] = time.perf_counter,
) -> Probe:
    def one(messages: Sequence[ChatMessage]) -> Usage:
        return client.complete(messages, temperature=0.7, max_tokens=max_tokens).usage

    start = clock()
    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        usages = list(pool.map(one, conversations))
    seconds = max(clock() - start, 1e-9)
    total = Usage()
    for usage in usages:
        total = total + usage
    return Probe(len(usages), total, seconds)


def measure(
    client: ChatClient,
    briefs: Sequence[Sequence[ChatMessage]],
    *,
    concurrency: int,
    decode_tokens: int = 512,
    rounds: int = 2,
    clock: Callable[[], float] = time.perf_counter,
) -> tuple[Throughput, Probe, Probe]:
    """Aggregate prefill and decode speed with `concurrency` requests in flight."""
    n = concurrency * rounds
    prompts = [briefs[i % len(briefs)] for i in range(n)]
    prefill = run_probe(client, prompts, max_tokens=1, concurrency=concurrency, clock=clock)
    decode = run_probe(
        client,
        [DECODE_PROMPT] * n,
        max_tokens=decode_tokens,
        concurrency=concurrency,
        clock=clock,
    )
    throughput = Throughput(
        prompt_tokens_per_sec=prefill.usage.input_tokens / prefill.seconds,
        generation_tokens_per_sec=decode.usage.output_tokens / decode.seconds,
    )
    return throughput, prefill, decode


def yaml_block(throughput: Throughput) -> str:
    return (
        "throughput:\n"
        f"  promptTokensPerSec: {throughput.prompt_tokens_per_sec:.0f}\n"
        f"  generationTokensPerSec: {throughput.generation_tokens_per_sec:.0f}"
    )
