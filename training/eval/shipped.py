"""Score predictions as the app shows them, not as the model wrote them.

Before the app shows or stores a tutor turn, `postValidate` in
`packages/core/src/tutor/validate.ts` drops corrections it cannot trust. The reply itself is
always kept. This module mirrors the checks that decide whether a correction survives, so
`eval report --as-shipped` and `eval learner-report --as-shipped` measure the tutor learners
actually get:

- a turn with both a prompt and a recast keeps only the recast
- a prompt or recast whose quoted learner text is not in the learner's message (whole words,
  any case, any apostrophe, edge punctuation ignored) is dropped
- a recast whose corrected text equals the quoted text, uses characters Italian text does not,
  or rewrites far more than the quoted span is dropped

Error tags are not rechecked: the strict parser already rejects unknown tags.
"""

from __future__ import annotations

import json
import re
from collections.abc import Mapping
from typing import Any

_EDGE = re.compile(r"^[\s.,!?;:«»\"“”()-]+|[\s.,!?;:«»\"“”()-]+$")
_APOSTROPHES = "['\u2019\u2018`\u00b4]"
_WORD = r"[^\W_]"


def normalise_italian(text: str) -> str:
    """Lowercase, unify apostrophes, collapse spaces, strip edge punctuation."""
    text = re.sub(_APOSTROPHES, "'", text.lower())
    return _EDGE.sub("", " ".join(text.split()))


def span_in_message(span: str, message: str) -> bool:
    """Whether `span` occurs in `message` as whole words, compared as `normalise_italian` does."""
    s = normalise_italian(span)
    if not s:
        return False
    body = "".join(
        _APOSTROPHES if ch == "'" else r"\s+" if ch == " " else re.escape(ch) for ch in s
    )
    # A span may start or end inside an elided word ("dell'"): the boundary is only required
    # next to a letter of the span itself.
    start = "" if s.startswith("'") else f"(?<!{_WORD})"
    end = "" if s.endswith("'") else f"(?!{_WORD})"
    return re.search(f"{start}{body}{end}", message, re.IGNORECASE) is not None


def _plausible(text: str) -> bool:
    return all(c.isalpha() or c.isdigit() or c in "'\u2019 \t\n.,!?;:«»\"“”()-" for c in text)


def _recast_kept(recast: Mapping[str, Any], learner_text: str) -> bool:
    wrong = normalise_italian(str(recast.get("learnerText", "")))
    right = normalise_italian(str(recast.get("correctedText", "")))
    return (
        span_in_message(str(recast.get("learnerText", "")), learner_text)
        and wrong != right
        and _plausible(str(recast.get("correctedText", "")))
        and len(right.split()) <= 2 * len(wrong.split()) + 4
    )


def as_shipped(raw: str, learner_text: str) -> str:
    """Raw model text with the corrections the app would drop removed.

    Text that is not a JSON object with annotations is returned unchanged, so the strict parser
    still counts it invalid.
    """
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return raw
    annotations = payload.get("annotations") if isinstance(payload, dict) else None
    if not isinstance(annotations, dict):
        return raw
    prompt, recast = annotations.get("prompt"), annotations.get("recast")
    if isinstance(recast, dict):
        prompt = None
        if not _recast_kept(recast, learner_text):
            recast = None
    if isinstance(prompt, dict) and not span_in_message(
        str(prompt.get("learnerText", "")), learner_text
    ):
        prompt = None
    annotations["prompt"], annotations["recast"] = prompt, recast
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def shipped_predictions(
    predictions: Mapping[str, str], learner_texts: Mapping[str, str]
) -> dict[str, str]:
    """Apply `as_shipped` to every prediction whose item has a learner message."""
    return {
        item_id: as_shipped(raw, learner_texts[item_id]) if item_id in learner_texts else raw
        for item_id, raw in predictions.items()
    }
