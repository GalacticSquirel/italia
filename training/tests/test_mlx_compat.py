"""The teacher server's ArraysCache patch: no lazy graph growth during decode, identical output."""

from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest

mx = pytest.importorskip("mlx.core")
pytest.importorskip("mlx_lm")

from mlx_lm.generate import BatchGenerator  # noqa: E402
from mlx_lm.models import qwen3_next  # noqa: E402
from mlx_lm.models.cache import ArraysCache  # noqa: E402

from datagen import mlx_compat, serve_teacher  # noqa: E402


class _FakeGenerator:
    def __init__(self, fail: bool) -> None:
        self.fail = fail
        self._generation_failed = False

    def _run_generate(self) -> None:  # stands in for mlx_lm's: logs and sets the flag
        if self.fail:
            self._generation_failed = True


def test_dead_generation_thread_exits_the_process(monkeypatch: pytest.MonkeyPatch) -> None:
    exits: list[int] = []
    monkeypatch.setattr(os, "_exit", exits.append)
    run = serve_teacher.exit_when_generation_dies(_FakeGenerator._run_generate)
    run(_FakeGenerator(fail=False))  # a clean stop does not exit
    assert exits == []
    run(_FakeGenerator(fail=True))  # mlx-lm would otherwise answer 404 forever
    assert exits == [serve_teacher.EXIT_GENERATION_DIED]


@pytest.fixture
def stock() -> Iterator[None]:
    mlx_compat.unpatch_arrays_cache()
    yield
    mlx_compat.unpatch_arrays_cache()


@pytest.fixture
def patched() -> Iterator[None]:
    mlx_compat.patch_arrays_cache()
    yield
    mlx_compat.unpatch_arrays_cache()


def graph_edges(value: Any, tmp_path: Path) -> int:
    """Number of edges in the unevaluated graph behind ``value``."""
    dot = tmp_path / "graph.dot"
    mx.export_to_dot(str(dot), value)
    return dot.read_text().count("->")


def merged_cache() -> Any:
    # What a cold-cache batch leaves behind: ArraysCache.merge gives left_padding = zeros(B).
    cache = ArraysCache.merge([ArraysCache(2)])
    cache.lengths = mx.array([128])
    mx.eval(cache.left_padding, cache.lengths)
    return cache


def test_stock_advance_grows_a_graph(stock: None, tmp_path: Path) -> None:
    cache = merged_cache()
    for _ in range(50):
        cache.advance(1)
    assert graph_edges(cache.left_padding, tmp_path) >= 50


def test_patched_advance_builds_no_graph(patched: None, tmp_path: Path) -> None:
    cache = merged_cache()
    stored = cache.__dict__["_left_padding"]
    cache.advance(1)
    one_step = graph_edges(cache.left_padding, tmp_path)
    stored = cache.__dict__["_left_padding"]
    for _ in range(4999):
        cache.advance(1)
    # nothing was created per step: same array object, the shift is a plain int
    assert cache.__dict__["_left_padding"] is stored
    assert cache.__dict__["_pending"] == 4999
    assert graph_edges(cache.left_padding, tmp_path) <= max(one_step, 1)
    assert cache.left_padding.tolist() == [-5000]
    assert cache.lengths.tolist() == [128 - 5000]


def test_advance_without_padding_is_a_no_op(patched: None) -> None:
    cache = ArraysCache(2)
    cache.advance(5)
    assert cache.left_padding is None and cache.lengths is None
    assert cache.__dict__.get("_pending", 0) == 0


def test_filter_extend_and_state_see_folded_values(patched: None) -> None:
    a = ArraysCache(1, left_padding=[4, 1])
    a[0] = mx.zeros((2, 3))
    a.advance(2)
    b = ArraysCache(1, left_padding=[7])
    b[0] = mx.ones((1, 3))
    b.advance(3)
    a.extend(b)
    assert a.left_padding.tolist() == [2, -1, 4]
    a.filter(mx.array([0, 2]))
    assert a.left_padding.tolist() == [2, 4]
    _, padding, lengths = a.state
    assert padding.tolist() == [2, 4] and lengths is None
    a.advance(1)
    a.state = (a.cache, mx.array([9, 9]), None)  # setter drops the pending shift
    assert a.left_padding.tolist() == [9, 9]
    a.finalize()
    assert a.left_padding is None


def run_cache_ops() -> list[Any]:
    """Advance, filter, extend, mask and finalize a cache, recording what callers see."""
    seen: list[Any] = []
    a = ArraysCache(2, left_padding=[3, 1, 0])
    a.prepare(lengths=[9, 7, 5])
    for _ in range(4):
        a.advance(1)
        seen.append(a.make_mask(6).tolist())
    a.filter(mx.array([0, 2]))
    seen += [a.left_padding.tolist(), a.lengths.tolist(), a.batch_size]
    b = ArraysCache(2, left_padding=[2])
    b.advance(2)
    a.extend(b)
    a.advance(3)
    seen += [a.left_padding.tolist(), a.make_mask(4).tolist()]
    _, left_padding, lengths = a.state
    seen += [left_padding.tolist(), lengths.tolist()]
    a.finalize()
    a.advance(5)
    seen += [a.left_padding, a.lengths, a.make_mask(3)]
    return seen


def test_patched_cache_matches_stock_values() -> None:
    mlx_compat.unpatch_arrays_cache()
    expected = run_cache_ops()
    mlx_compat.patch_arrays_cache()
    try:
        assert run_cache_ops() == expected
    finally:
        mlx_compat.unpatch_arrays_cache()


def tiny_qwen3_next() -> Any:
    mx.random.seed(0)
    args = qwen3_next.ModelArgs(
        model_type="qwen3_next",
        hidden_size=32,
        num_hidden_layers=8,
        intermediate_size=64,
        num_attention_heads=2,
        linear_num_value_heads=2,
        linear_num_key_heads=1,
        linear_key_head_dim=16,
        linear_value_head_dim=16,
        linear_conv_kernel_dim=4,
        num_experts=4,
        num_experts_per_tok=2,
        decoder_sparse_step=1,
        shared_expert_intermediate_size=32,
        mlp_only_layers=[],
        moe_intermediate_size=32,
        rms_norm_eps=1e-6,
        vocab_size=64,
        num_key_value_heads=1,
        rope_theta=10000.0,
        partial_rotary_factor=0.25,
        max_position_embeddings=4096,
        head_dim=16,
    )
    model = qwen3_next.Model(args)
    mx.eval(model.parameters())
    return model


def decode(steps: int) -> tuple[dict[int, list[int]], list[Any]]:
    """Greedy-decode through BatchGenerator (the server path), with prompts joining mid-run."""
    model = tiny_qwen3_next()
    gen = BatchGenerator(model, max_tokens=steps, prefill_step_size=64)
    (first,) = gen.insert([[1, 2, 3, 4, 5, 6]], max_tokens=[steps])
    tokens: dict[int, list[int]] = {}
    for step in range(steps):
        if step in (5, 40):
            gen.insert([[7]] if step == 5 else [[9, 8, 7, 6]], max_tokens=[steps])
        for response in gen.next_generated():
            tokens.setdefault(response.uid, []).append(response.token)
    caches = [c for c in gen._generation_batch.prompt_cache if isinstance(c, ArraysCache)]
    assert first in tokens
    return tokens, caches


def test_patched_server_decode_is_identical_and_flat(tmp_path: Path) -> None:
    mlx_compat.unpatch_arrays_cache()
    expected, stock_caches = decode(120)
    stock_edges = max(graph_edges(c.left_padding, tmp_path) for c in stock_caches)
    mlx_compat.patch_arrays_cache()
    try:
        tokens, caches = decode(120)
        edges = max(graph_edges(c.left_padding, tmp_path) for c in caches)
    finally:
        mlx_compat.unpatch_arrays_cache()
    assert tokens == expected
    assert stock_edges > 50, "the stock decode loop no longer leaks; drop the patch"
    assert edges <= 6


def test_patch_is_idempotent_and_reversible(stock: None) -> None:
    original = ArraysCache.advance
    assert mlx_compat.patch_arrays_cache() is True
    assert mlx_compat.patch_arrays_cache() is False
    assert mlx_compat.is_patched()
    mlx_compat.unpatch_arrays_cache()
    assert ArraysCache.advance is original
    assert not mlx_compat.is_patched()
