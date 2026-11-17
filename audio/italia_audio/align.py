"""Word timings by forced alignment of a clip to its known text (multilingual MMS aligner).

The reader highlights each word as it is said. Timings are stored as
``[charStart, charEnd, startMs, endMs]`` over the normalised text, so the app can map them
onto its own tokens by character position.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any

from .encode import Samples, resample

_WORD = re.compile(r"[\w']+(?:'[\w]+)*", re.UNICODE)


def words(text: str) -> list[tuple[int, int, str]]:
    """Words of the text as ``(start, end, aligner spelling)``; words with no letters are dropped.

    The aligner knows ``a``-``z`` and ``'``: accents are removed and other characters dropped.
    """
    out: list[tuple[int, int, str]] = []
    for m in _WORD.finditer(text):
        plain = unicodedata.normalize("NFD", m.group().lower())
        spelled = "".join(c for c in plain if "a" <= c <= "z" or c == "'").strip("'")
        if any("a" <= c <= "z" for c in spelled):
            out.append((m.start(), m.end(), spelled))
    return out


class Aligner:
    """Loads the aligner once; :meth:`timings` aligns one clip."""

    RATE = 16_000

    def __init__(self) -> None:
        import torch
        from torchaudio.pipelines import MMS_FA

        self._torch: Any = torch
        self._model: Any = MMS_FA.get_model(with_star=False)
        self._model.eval()
        self._tokenizer: Any = MMS_FA.get_tokenizer()
        self._aligner: Any = MMS_FA.get_aligner()

    def timings(self, text: str, samples: Samples, sample_rate: int) -> list[list[int]]:
        spans = words(text)
        if not spans:
            return []
        torch = self._torch
        audio = torch.from_numpy(resample(samples, sample_rate, self.RATE)).unsqueeze(0)
        with torch.inference_mode():
            emission, _ = self._model(audio)
            token_spans = self._aligner(emission[0], self._tokenizer([s[2] for s in spans]))
        seconds_per_frame = audio.size(1) / emission.size(1) / self.RATE
        out: list[list[int]] = []
        for (start, end, _), word_spans in zip(spans, token_spans, strict=True):
            t0 = round(word_spans[0].start * seconds_per_frame * 1000)
            t1 = round(word_spans[-1].end * seconds_per_frame * 1000)
            out.append([start, end, t0, t1])
        return out
