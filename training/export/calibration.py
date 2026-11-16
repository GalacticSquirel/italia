"""imatrix calibration text from in-domain tutoring dialogues (Italian, not WikiText)."""

from __future__ import annotations

import json
import random
from collections.abc import Iterable, Mapping, Sequence
from typing import Any


def calibration_text(
    examples: Iterable[Mapping[str, Any]],
    *,
    max_chars: int = 2_000_000,
    seed: int = 0,
) -> str:
    """Plain-text conversations (system prompt, learner lines, tutor JSON), shuffled, capped.

    A few hundred thousand tokens is plenty for an importance matrix; include the JSON
    annotations because the model must stay accurate on them too.
    """
    rows = list(examples)
    random.Random(seed).shuffle(rows)
    parts: list[str] = []
    size = 0
    for row in rows:
        block = _render(row["messages"])
        if size + len(block) > max_chars:
            break
        parts.append(block)
        size += len(block)
    return "\n\n".join(parts)


def _render(messages: Sequence[Mapping[str, str]]) -> str:
    lines = []
    for m in messages:
        content = m["content"]
        if m["role"] == "assistant":
            try:
                reply = json.loads(content)["reply"]
                lines.append(f"Tutor: {reply}\n{content}")
                continue
            except (json.JSONDecodeError, KeyError, TypeError):
                pass
        label = {"system": "Istruzioni", "user": "Studente"}.get(m["role"], "Tutor")
        lines.append(f"{label}: {content}")
    return "\n".join(lines)
