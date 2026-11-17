"""Clip keys: the app finds a clip by hashing the text it wants spoken.

The same rules are implemented in ``apps/mobile/src/audio/clipKey.ts``; both are tested against
``audio/tests/clip-keys.json`` so they cannot drift apart.
"""

from __future__ import annotations

import hashlib
import re
import unicodedata

_SPACE = re.compile(r"\s+")
_APOSTROPHES = str.maketrans({"\u2019": "'", "\u2018": "'", "\u02bc": "'"})

KEY_LENGTH = 16


def normalise(text: str) -> str:
    """Canonical spoken text: NFC, typographic apostrophes as ``'``, single spaces, trimmed.

    Case and punctuation are kept: they change how a sentence is said.
    """
    text = unicodedata.normalize("NFC", text).translate(_APOSTROPHES)
    return _SPACE.sub(" ", text).strip()


def clip_key(text: str) -> str:
    """First 16 hex digits of the SHA-256 of the normalised text (UTF-8)."""
    return hashlib.sha256(normalise(text).encode("utf-8")).hexdigest()[:KEY_LENGTH]
