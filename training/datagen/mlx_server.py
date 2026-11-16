"""Run the local teacher with mlx-lm's OpenAI-compatible server, without its decode-time leak.

``python -m datagen.mlx_server <mlx_lm.server arguments>`` patches mlx-lm and then hands over to
``mlx_lm.server.main``, so every server flag works as before.

The leak: hybrid models such as Qwen3-Next keep their linear-attention state in ``ArraysCache``.
Each decode step calls ``advance(1)``, which runs ``left_padding -= 1`` (and the same on
``lengths``). MLX is lazy, and the batched decode loop only evaluates the mask of one linear
layer, so on every other layer this builds an ever longer unevaluated ``x - 1 - 1 - ...`` chain.
Every node pins a small Metal buffer. Metal limits the number of buffers (499,000), not bytes,
so active memory stays flat while the server dies with ``[metal::malloc] Resource limit
(499000) exceeded`` once a decode slot has run about 499000 / (linear layers - 1) steps. For the
80B-A3B teacher (36 linear layers) that is about 14k steps, which a busy batch reaches every few
minutes. Upstream tracks this as ml-explore/mlx-lm issue 1845.

The fix keeps the pending shift as a Python int. ``advance`` touches no arrays at all, and the
``left_padding`` and ``lengths`` properties subtract the pending shift when they are read,
without storing the result back (storing it back would grow a new chain from unevaluated reads).
Assignments (when a sequence joins or leaves the batch) are evaluated asynchronously so that
those rarer edits cannot build a chain either. The values every caller sees are unchanged, so
generated tokens are identical.
"""

from __future__ import annotations

import logging
import os
import sys
from collections.abc import Callable
from typing import Any, cast

import mlx.core as mx
from mlx_lm import server
from mlx_lm.models.cache import ArraysCache

# mx.async_eval is untyped in MLX's stubs.
_async_eval = cast("Any", mx.async_eval)
_PATCH_FLAG = "_italia_shift_patch"
_FIELDS = ("left_padding", "lengths")
_originals: dict[str, Any] = {}


def _field_property(name: str) -> property:
    raw = f"_raw_{name}"
    pending = f"_pending_{name}"

    def getter(self: Any) -> mx.array | None:
        value: mx.array | None = self.__dict__.get(raw)
        shift: int = self.__dict__.get(pending, 0)
        if value is None or shift == 0:
            return value
        return value - shift

    def setter(self: Any, value: mx.array | None) -> None:
        if value is not None:
            # Assignments happen when a sequence joins or leaves the batch (filter, extend,
            # merge), not per token, but each one would otherwise keep its expression alive.
            _async_eval(value)
        self.__dict__[raw] = value
        self.__dict__[pending] = 0

    return property(getter, setter, doc=f"``{name}`` with any pending advance applied.")


def _advance(self: Any, n: int) -> None:
    for name in _FIELDS:
        if self.__dict__.get(f"_raw_{name}") is not None:
            self.__dict__[f"_pending_{name}"] = self.__dict__.get(f"_pending_{name}", 0) + n


def is_patched() -> bool:
    """Whether :func:`patch_arrays_cache` is in effect."""
    return bool(getattr(ArraysCache, _PATCH_FLAG, False))


def patch_arrays_cache() -> None:
    """Make ``ArraysCache.advance`` build no lazy graph. Safe to call more than once."""
    if is_patched():
        return
    for name in (*_FIELDS, "advance"):
        _originals[name] = ArraysCache.__dict__.get(name)
    for name in _FIELDS:
        setattr(ArraysCache, name, _field_property(name))
    ArraysCache.advance = _advance
    setattr(ArraysCache, _PATCH_FLAG, True)


def unpatch_arrays_cache() -> None:
    """Restore mlx-lm's own ``ArraysCache`` (used by tests to compare against it)."""
    if not is_patched():
        return
    for name, original in _originals.items():
        if original is None:
            delattr(ArraysCache, name)
        else:
            setattr(ArraysCache, name, original)
    delattr(ArraysCache, _PATCH_FLAG)
    _originals.clear()


# Exit status when mlx-lm's generation thread has died; scripts/serve-teacher.sh restarts on it.
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
        generator._run_generate = exit_when_generation_dies(generator._run_generate)
        generator._italia_exit_on_death = True
    sys.argv = ["mlx_lm.server", *(sys.argv[1:] if argv is None else argv)]
    server.main()


if __name__ == "__main__":
    main()
