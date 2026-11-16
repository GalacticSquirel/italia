"""Run `mlx_lm.server` with the fixes in `datagen.mlx_compat` applied.

Takes exactly the arguments of `mlx_lm.server` (scripts/serve-teacher.sh sizes them for the Mac):

    uv run python -m datagen.serve_teacher --model "$LOCAL_TEACHER_MODEL" --port 8080 \\
        --decode-concurrency 8 --prompt-concurrency 2

Besides the ArraysCache leak fix, the process exits with EXIT_GENERATION_DIED when mlx-lm's
generation thread dies, so scripts/serve-teacher.sh can restart it.
"""

from __future__ import annotations

import logging
import os
import sys
from collections.abc import Callable
from typing import Any

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
    from mlx_lm import server  # noqa: PLC0415 - optional dependency (the `mlx` extra)

    from datagen.mlx_compat import patch_arrays_cache  # noqa: PLC0415

    patch_arrays_cache()
    logging.getLogger(__name__).warning("datagen.mlx_compat: ArraysCache leak fix applied")
    generator = server.ResponseGenerator
    if not getattr(generator, "_italia_exit_on_death", False):
        generator._run_generate = exit_when_generation_dies(generator._run_generate)
        generator._italia_exit_on_death = True
    sys.argv = ["mlx_lm.server", *(sys.argv[1:] if argv is None else argv)]
    server.main()


if __name__ == "__main__":
    main()
