"""What needs audio: every lemma, seed sentence and story sentence, read from the content seed."""

from __future__ import annotations

import json
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from .textkey import clip_key, normalise

REPO_ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = REPO_ROOT / "packages" / "content" / "seed"

Kind = Literal["word", "sentence", "story"]
KINDS: tuple[Kind, ...] = ("word", "sentence", "story")


@dataclass(frozen=True)
class Utterance:
    """One text to record, with its clip key."""

    key: str
    text: str
    kind: Kind


def _story_texts(stories: dict[str, Any]) -> Iterator[str]:
    for story in stories.get("stories", []):
        yield story["title"]["it"]
        for paragraph in story["paragraphs"]:
            for sentence in paragraph["sentences"]:
                yield sentence["it"]
        for question in story.get("questions", []):
            yield (
                question["prompt"]["it"]
                if isinstance(question["prompt"], dict)
                else question["prompt"]
            )
            for option in question.get("options", []):
                yield option["it"] if isinstance(option, dict) else option


def collect(seed: dict[str, Any], stories: dict[str, Any]) -> list[Utterance]:
    """Every distinct utterance, words first, then sentences, then stories.

    Text that appears in several places (a story sentence that is also a seed sentence) is
    listed once, under its first kind, since the app looks clips up by text alone.
    """
    seen: set[str] = set()
    out: list[Utterance] = []

    def add(texts: Iterable[str], kind: Kind) -> None:
        for raw in texts:
            text = normalise(raw)
            if not text:
                continue
            key = clip_key(text)
            if key in seen:
                continue
            seen.add(key)
            out.append(Utterance(key=key, text=text, kind=kind))

    lemmas = sorted(seed["lemmas"], key=lambda lemma: lemma["freqRank"])
    add((lemma["lemma"] for lemma in lemmas), "word")
    add((s["it"] for s in seed["sentences"]), "sentence")
    add(_story_texts(stories), "story")
    return out


def load(seed_dir: Path = SEED_DIR) -> list[Utterance]:
    """Utterances from the committed seed files (``seed.v1.json`` and ``stories.v1.json``)."""
    seed = json.loads((seed_dir / "seed.v1.json").read_text("utf-8"))
    stories_path = seed_dir / "stories.v1.json"
    stories = json.loads(stories_path.read_text("utf-8")) if stories_path.exists() else {}
    return collect(seed, stories)
