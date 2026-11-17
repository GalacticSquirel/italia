import numpy as np

from italia_audio.encode import PAD_SECONDS, SAMPLE_RATE, level, prepare, trim


def test_trim_and_pad() -> None:
    rate = SAMPLE_RATE
    tone = (0.5 * np.sin(np.arange(rate) * 2 * np.pi * 220 / rate)).astype(np.float32)
    silence = np.zeros(rate, dtype=np.float32)
    padded = np.concatenate([silence, tone, silence])
    trimmed = trim(padded, rate)
    assert abs(len(trimmed) - rate) < rate * 0.05
    out = prepare(padded, rate)
    assert abs(len(out) - (rate + 2 * PAD_SECONDS * rate)) < rate * 0.05


def test_level_respects_ceiling() -> None:
    loud = np.full(1000, 0.99, dtype=np.float32)
    assert float(np.max(np.abs(level(loud)))) <= 0.89 + 1e-6
