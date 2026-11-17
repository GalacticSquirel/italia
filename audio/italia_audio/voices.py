"""The synthetic voices and the packs they fill.

Chosen by measuring intelligibility (speech-recognition word error rate against the text) and
predicted quality on a fixed sample of seed and story sentences; see ``audio/README.md``.
Kokoro voices are clearest on sentences but blur the first consonant of isolated words
(*piccolo* heard as *bicolo*), so single words come from the Piper voice and real speakers.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

from .content import Kind
from .encode import Samples
from .pack import VoiceInfo

Synth = Callable[[str], tuple[Samples, int]]


@dataclass(frozen=True)
class PackSpec:
    """One downloadable pack: who speaks and what it covers."""

    id: str
    title: str
    description: str
    licence: str
    source: str
    voice: VoiceInfo
    kinds: tuple[Kind, ...]
    #: Word timings are aligned for these kinds (the reader highlights words as they are said).
    timed: tuple[Kind, ...] = ()
    #: Real-speaker recordings used before the synthetic voice, where they exist.
    native: bool = False


PACKS: dict[str, PackSpec] = {
    spec.id: spec
    for spec in (
        PackSpec(
            id="audio-words",
            title="Word recordings",
            description=(
                "Every word said aloud: recordings by native speakers from Lingua Libre where "
                "there is one, and the Serena voice for the rest."
            ),
            licence="CC-BY-SA-4.0 AND CC-BY-4.0 AND CC0-1.0 AND MIT",
            source="https://lingualibre.org",
            voice=VoiceInfo(
                id="piper-it_IT-serena-medium", name="Serena", gender="female", native=False
            ),
            kinds=("word",),
            native=True,
        ),
        PackSpec(
            id="audio-voice-sara",
            title="Sentence and story audio (Sara)",
            description=(
                "Every lesson sentence and story read by Sara, with word timings for "
                "following along in stories."
            ),
            licence="Apache-2.0",
            source="https://huggingface.co/hexgrad/Kokoro-82M",
            voice=VoiceInfo(id="kokoro-if_sara", name="Sara", gender="female", native=False),
            kinds=("sentence", "story"),
            timed=("story",),
        ),
        PackSpec(
            id="audio-voice-nicola",
            title="Sentence and story audio (Nicola)",
            description=(
                "Every lesson sentence and story read by Nicola, a second voice so you hear "
                "Italian from more than one speaker."
            ),
            licence="Apache-2.0",
            source="https://huggingface.co/hexgrad/Kokoro-82M",
            voice=VoiceInfo(id="kokoro-im_nicola", name="Nicola", gender="male", native=False),
            kinds=("sentence", "story"),
            timed=("story",),
        ),
    )
}

PIPER_VOICES = "https://huggingface.co/rhasspy/piper-voices/resolve/main/it/it_IT"


def _piper(name: str, cache: Path) -> Synth:
    import urllib.request

    from piper import PiperVoice

    quality = name.rsplit("-", 1)[-1]
    speaker = name.split("-")[1]
    model = cache / f"{name}.onnx"
    for suffix in (".onnx", ".onnx.json"):
        target = cache / f"{name}{suffix}"
        if not target.exists():
            cache.mkdir(parents=True, exist_ok=True)
            urllib.request.urlretrieve(f"{PIPER_VOICES}/{speaker}/{quality}/{name}{suffix}", target)
    voice: Any = PiperVoice.load(str(model))

    def synth(text: str) -> tuple[Samples, int]:
        chunks = [c.audio_float_array for c in voice.synthesize(text)]
        return np.concatenate(chunks).astype(np.float32), int(voice.config.sample_rate)

    return synth


def _kokoro(voice: str) -> Synth:
    from kokoro import KPipeline

    pipeline: Any = KPipeline(lang_code="i", repo_id="hexgrad/Kokoro-82M")

    def synth(text: str) -> tuple[Samples, int]:
        parts = [r.audio.numpy() for r in pipeline(text, voice=voice) if r.audio is not None]
        return np.concatenate(parts).astype(np.float32), 24_000

    return synth


def synthesiser(voice_id: str, cache: Path) -> Synth:
    """A text-to-samples function for a voice id such as ``kokoro-if_sara``."""
    engine, _, name = voice_id.partition("-")
    if engine == "kokoro":
        return _kokoro(name)
    if engine == "piper":
        return _piper(name, cache)
    raise ValueError(f"Unknown voice {voice_id}")
