"""Clean up and encode clips: trim silence, level loudness, pad, and write AAC in an MP4 (m4a).

AAC in MP4 plays on both Android (Media3) and iOS (AVFoundation) without extra decoders.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

import numpy as np
import numpy.typing as npt

Samples = npt.NDArray[np.float32]

#: Output sample rate and bit rate: plenty for one voice, about 5 KB a second.
SAMPLE_RATE = 24_000
BITRATE = "40k"
#: Silence kept before and after the speech, in seconds.
PAD_SECONDS = 0.12
#: Frames quieter than this (relative to the loudest frame) count as silence when trimming.
TRIM_DB = -40.0
#: Target RMS level of the speech, in dBFS, and the peak ceiling.
TARGET_RMS_DB = -20.0
PEAK_CEILING = 0.89


def _frames_db(samples: Samples, frame: int) -> npt.NDArray[np.float64]:
    n = len(samples) // frame
    if n == 0:
        return np.array([-120.0])
    framed = samples[: n * frame].astype(np.float64).reshape(n, frame)
    rms = np.sqrt(np.mean(framed**2, axis=1)) + 1e-12
    return np.asarray(20 * np.log10(rms), dtype=np.float64)


def trim(samples: Samples, sample_rate: int) -> Samples:
    """Cut leading and trailing silence (10 ms frames below :data:`TRIM_DB` of the peak frame)."""
    frame = max(1, sample_rate // 100)
    db = _frames_db(samples, frame)
    loud = np.flatnonzero(db > db.max() + TRIM_DB)
    if len(loud) == 0:
        return samples
    start = max(0, (int(loud[0]) - 1) * frame)
    end = min(len(samples), (int(loud[-1]) + 2) * frame)
    return samples[start:end]


def level(samples: Samples) -> Samples:
    """Scale to :data:`TARGET_RMS_DB` RMS over voiced frames, without exceeding the ceiling."""
    if len(samples) == 0:
        return samples
    voiced = samples[np.abs(samples) > 1e-3]
    rms = float(np.sqrt(np.mean(voiced.astype(np.float64) ** 2))) if len(voiced) else 0.0
    if rms <= 0:
        return samples
    gain = 10 ** (TARGET_RMS_DB / 20) / rms
    peak = float(np.max(np.abs(samples)))
    gain = min(gain, PEAK_CEILING / peak) if peak > 0 else gain
    return np.asarray(samples * gain, dtype=np.float32)


def resample(samples: Samples, source_rate: int, target_rate: int = SAMPLE_RATE) -> Samples:
    """Band-limited resampling (polyphase), or the input when the rates match."""
    if source_rate == target_rate:
        return samples.astype(np.float32, copy=False)
    from math import gcd

    from scipy.signal import resample_poly

    g = gcd(source_rate, target_rate)
    out = resample_poly(samples.astype(np.float64), target_rate // g, source_rate // g)
    return np.asarray(out, dtype=np.float32)


def prepare(samples: Samples, sample_rate: int) -> Samples:
    """Resample to :data:`SAMPLE_RATE`, trim, level and pad: the exact audio that is encoded."""
    audio = level(trim(resample(np.asarray(samples, dtype=np.float32), sample_rate), SAMPLE_RATE))
    pad = np.zeros(int(PAD_SECONDS * SAMPLE_RATE), dtype=np.float32)
    return np.concatenate([pad, audio, pad])


def duration_ms(samples: Samples, sample_rate: int = SAMPLE_RATE) -> int:
    return round(len(samples) * 1000 / sample_rate)


def write_m4a(samples: Samples, path: Path, sample_rate: int = SAMPLE_RATE) -> None:
    """Encode mono float samples to AAC-LC in an m4a file with ffmpeg."""
    path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "f32le",
            "-ar",
            str(sample_rate),
            "-ac",
            "1",
            "-i",
            "pipe:0",
            "-c:a",
            "aac",
            "-b:a",
            BITRATE,
            "-movflags",
            "+faststart",
            "-map_metadata",
            "-1",
            "-fflags",
            "+bitexact",
            "-flags:a",
            "+bitexact",
            str(path),
        ],
        input=np.asarray(samples, dtype="<f4").tobytes(),
        check=True,
    )


def decode(path: Path, sample_rate: int = SAMPLE_RATE) -> Samples:
    """Decode any audio file ffmpeg reads to mono float samples at ``sample_rate``."""
    out = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(path),
            "-f",
            "f32le",
            "-ac",
            "1",
            "-ar",
            str(sample_rate),
            "pipe:1",
        ],
        capture_output=True,
        check=True,
    ).stdout
    return np.frombuffer(out, dtype="<f4").copy()
