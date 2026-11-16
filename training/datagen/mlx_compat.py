"""Workarounds for mlx-lm bugs that affect the local teacher server (`datagen.serve_teacher`).

ArraysCache Metal buffer leak (mlx-lm 0.32.2; upstream ml-explore/mlx-lm#1641 and #1845).
Hybrid models (Qwen3-Next, Qwen3.5) keep each linear-attention layer's state in an `ArraysCache`
whose `advance()` does `left_padding -= N` on an `mx.array` at every decode step. The batched
decode loop never evaluates cache state, and the model only builds its mask from the first linear
layer's cache, so on every other linear layer that subtraction stays an unevaluated chain
`x - 1 - 1 - ...` for as long as the generation batch lives. Each node pins a live Metal buffer.
Metal caps buffers by count (499,000), not bytes, so the server's generation thread dies with
"[metal::malloc] Resource limit (499000) exceeded" after about 499000 / (linear layers - 1) decode
steps (about 8 minutes for Qwen3-Next-80B at 8 in flight) while memory use stays flat.

The patch keeps the advance as a Python int and folds it in only when `left_padding` or `lengths`
is read, and evaluates every array stored there, so neither per-step advances nor the batch's
filter/extend calls can build an unbounded graph. Values and masks are unchanged.
"""

from __future__ import annotations

from typing import Any, cast

_PATCHED_FLAG = "_italia_advance_patched"
_PATCHED_NAMES = ("left_padding", "lengths", "advance")
_originals: dict[str, Any] = {}


def is_patched() -> bool:
    """Whether :func:`patch_arrays_cache` is in effect."""
    from mlx_lm.models.cache import ArraysCache  # noqa: PLC0415 - optional dependency

    return bool(getattr(ArraysCache, _PATCHED_FLAG, False))


def patch_arrays_cache() -> bool:
    """Patch `mlx_lm.models.cache.ArraysCache` in place. Returns False if already patched."""
    import mlx.core as mx  # noqa: PLC0415 - optional dependency (the `mlx` extra)
    from mlx_lm.models.cache import ArraysCache  # noqa: PLC0415

    if is_patched():
        return False
    async_eval = cast("Any", mx.async_eval)  # untyped in MLX's stubs

    def store(value: Any) -> Any:
        if isinstance(value, mx.array):
            async_eval(value)  # a concrete array never chains back to older steps
        return value

    def fold(self: Any) -> None:
        pending = self.__dict__.get("_pending", 0)
        if not pending:
            return
        self.__dict__["_pending"] = 0
        for key in ("_left_padding", "_lengths"):
            value = self.__dict__.get(key)
            if value is not None:
                self.__dict__[key] = store(value - pending)

    def field(name: str) -> property:
        key = "_" + name

        def get(self: Any) -> Any:
            fold(self)
            return self.__dict__.get(key)

        def set_(self: Any, value: Any) -> None:
            fold(self)
            self.__dict__[key] = store(value)

        return property(get, set_)

    def advance(self: Any, n: int) -> None:
        if (
            self.__dict__.get("_left_padding") is not None
            or self.__dict__.get("_lengths") is not None
        ):
            self.__dict__["_pending"] = self.__dict__.get("_pending", 0) + n

    for name in _PATCHED_NAMES:
        _originals[name] = ArraysCache.__dict__.get(name)
    ArraysCache.left_padding = field("left_padding")
    ArraysCache.lengths = field("lengths")
    ArraysCache.advance = advance
    setattr(ArraysCache, _PATCHED_FLAG, True)
    return True


def unpatch_arrays_cache() -> None:
    """Restore mlx-lm's own `ArraysCache` (tests compare against it). Caches created while
    patched keep their values under private names, so only use fresh caches afterwards."""
    from mlx_lm.models.cache import ArraysCache  # noqa: PLC0415

    if not is_patched():
        return
    for name, original in _originals.items():
        if original is None:
            delattr(ArraysCache, name)
        else:
            setattr(ArraysCache, name, original)
    delattr(ArraysCache, _PATCHED_FLAG)
    _originals.clear()
