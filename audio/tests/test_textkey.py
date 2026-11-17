import json
from pathlib import Path

from italia_audio.textkey import clip_key, normalise

VECTORS = json.loads((Path(__file__).parent / "clip-keys.json").read_text("utf-8"))


def test_shared_vectors() -> None:
    for case in VECTORS:
        assert normalise(case["text"]) == case["normalised"]
        assert clip_key(case["text"]) == case["key"]


def test_case_and_punctuation_matter() -> None:
    assert clip_key("Casa") != clip_key("casa")
    assert clip_key("Vieni.") != clip_key("Vieni?")
