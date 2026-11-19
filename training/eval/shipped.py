"""Score predictions as the app shows them, not as the model wrote them.

Before the app shows or stores a tutor turn, `postValidate` in
`packages/core/src/tutor/validate.ts` drops corrections it cannot trust. The reply itself is
always kept. This module mirrors the checks that decide whether a correction survives, so
`eval report --as-shipped` and `eval learner-report --as-shipped` measure the tutor learners
actually get:

- a turn with both a prompt and a recast keeps only the recast
- a prompt or recast whose quoted learner text is not in the learner's message (whole words,
  any case, any apostrophe, edge punctuation ignored) is snapped to the closest run of the
  learner's words when one is near enough (`snap_span`), and dropped otherwise
- a recast whose corrected text equals the quoted text, uses characters Italian text does not,
  or rewrites far more than the quoted span is dropped

Error tags are not rechecked: the strict parser already rejects unknown tags. `strict=True`
scores the older rule, which dropped every span not found exactly.
"""

from __future__ import annotations

import json
import re
import unicodedata
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
    return _find_span(span, message) is not None


def _fold_italian(text: str) -> str:
    decomposed = unicodedata.normalize("NFD", normalise_italian(text))
    return "".join(c for c in decomposed if not unicodedata.category(c).startswith("M"))


def _edit_distance(a: str, b: str) -> int:
    row = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        nxt = [i]
        for j, cb in enumerate(b, 1):
            nxt.append(min(row[j] + 1, nxt[j - 1] + 1, row[j - 1] + (ca != cb)))
        row = nxt
    return row[-1]


def _find_span(span: str, message: str) -> re.Match[str] | None:
    s = normalise_italian(span)
    if not s:
        return None
    body = "".join(
        _APOSTROPHES if ch == "'" else r"\s+" if ch == " " else re.escape(ch) for ch in s
    )
    # A span may start or end inside an elided word ("dell'"): the boundary is only required
    # next to a letter of the span itself.
    start = "" if s.startswith("'") else f"(?<!{_WORD})"
    end = "" if s.endswith("'") else f"(?!{_WORD})"
    return re.search(f"{start}{body}{end}", message, re.IGNORECASE)


def snap_span(span: str, message: str) -> str | None:
    """The learner's own words that `span` quotes, as `snapSpan` in validate.ts finds them.

    An exact whole-word match wins. Otherwise the closest run of the message's words (one word
    fewer to one more than the span) is taken if its accent-free text is within one edit per
    five letters of the span. None when nothing is that close.
    """
    exact = _find_span(span, message)
    if exact is not None:
        return exact.group(0)
    target = _fold_italian(span)
    if not target:
        return None
    limit = len(target) // 5
    tokens = [(m.start(), m.end()) for m in re.finditer(r"\S+", message)]
    n = len(target.split(" "))
    best: tuple[int, str] | None = None
    for size in range(max(1, n - 1), n + 2):
        for i in range(len(tokens) - size + 1):
            text = _EDGE.sub("", message[tokens[i][0] : tokens[i + size - 1][1]])
            if not text:
                continue
            distance = _edit_distance(target, _fold_italian(text))
            if distance <= limit and (best is None or distance < best[0]):
                best = (distance, text)
    return None if best is None else best[1]


def _plausible(text: str) -> bool:
    return all(c.isalpha() or c.isdigit() or c in "'\u2019 \t\n.,!?;:«»\"“”()-" for c in text)


def _quoted(item: Mapping[str, Any], learner_text: str, strict: bool) -> str | None:
    span = str(item.get("learnerText", ""))
    if strict:
        return span if span_in_message(span, learner_text) else None
    return snap_span(span, learner_text)


def _recast_kept(recast: dict[str, Any], learner_text: str, strict: bool) -> bool:
    quoted = _quoted(recast, learner_text, strict)
    if quoted is None:
        return False
    recast["learnerText"] = quoted
    wrong = normalise_italian(quoted)
    right = normalise_italian(str(recast.get("correctedText", "")))
    return (
        wrong != right
        and _plausible(str(recast.get("correctedText", "")))
        and len(right.split()) <= 2 * len(wrong.split()) + 4
    )


def as_shipped(raw: str, learner_text: str, *, strict: bool = False) -> str:
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
        if not _recast_kept(recast, learner_text, strict):
            recast = None
    if isinstance(prompt, dict):
        quoted = _quoted(prompt, learner_text, strict)
        if quoted is None:
            prompt = None
        else:
            prompt["learnerText"] = quoted
    annotations["prompt"], annotations["recast"] = prompt, recast
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def shipped_predictions(
    predictions: Mapping[str, str], learner_texts: Mapping[str, str], *, strict: bool = False
) -> dict[str, str]:
    """Apply `as_shipped` to every prediction whose item has a learner message."""
    return {
        item_id: as_shipped(raw, learner_texts[item_id], strict=strict)
        if item_id in learner_texts
        else raw
        for item_id, raw in predictions.items()
    }
