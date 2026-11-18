"""Real learner Italian with native corrections, from the MERLIN corpus.

MERLIN (Eurac Research, CC BY-SA 4.0) holds 813 Italian texts written by learners in CEFR exams,
each rated A1 to B2 and paired with a native speaker's minimal correction ("target hypothesis 1").
This module turns them into sentence pairs: the learner's sentence and the native correction.

The pairs are the one source in the training pipeline that no model wrote, so they serve two
purposes:

- a held-out check (`eval learner-items`): does the tutor notice the errors real learners make,
  leave alone the sentences a native corrector left alone, and fix them the way a native would?
- material for hand-written dialogues whose learner turns are real learner sentences.

Authors are split 80/20 into `train` and `eval` by a hash of their id, so a learner's sentences
never appear on both sides.
"""

from __future__ import annotations

import difflib
import hashlib
import re
import urllib.request
import zipfile
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from spec.levels import Level
from spec.models import WireModel

MERLIN_URL = (
    "https://clarin.eurac.edu/repository/xmlui/bitstream/handle/20.500.12124/59/"
    "merlin-text-v1.2.zip?sequence=17&isAllowed=y"
)
MERLIN_SHA256 = "949f1ef6c22e6602c28fc971115fa23c9a575a99c17adf8ca23630b928eb63eb"
MERLIN_TEXTS = "merlin-text-v1.2/meta_ltext_THs/italian/"
DEFAULT_PAIRS = Path(__file__).resolve().parent.parent / "data" / "learner" / "merlin-it.jsonl"

EVAL_SHARE = 5  # one author in five is held out
MIN_WORDS, MAX_WORDS = 3, 40
MIN_RATIO, MAX_RATIO = 0.7, 1.4
LEVELS = {"A1", "A2", "B1", "B2"}

_TOKEN = re.compile(r"\w+'|\w+|[^\w\s]")
_WORD = re.compile(r"\w+")
_SENTENCE_END = {".", "!", "?"}
# Anonymised names ("Città X", "Paese X"), e-mail addresses and illegible passages.
_PLACEHOLDER = re.compile(r"\bX\b|@|unreadable")
_APOSTROPHES = {0x2019: "'", 0x00B4: "'"}  # typographic apostrophe, acute accent
_META = re.compile(r"^(Author ID|Overall CEFR rating|Mother tongue|Task ?): (.*)$", re.M)


class LearnerPair(WireModel):
    """One learner sentence and its native correction."""

    id: str
    author: str
    level: Level
    l1: str
    task: str
    learner: str
    native: str
    changed: bool  # the native corrector changed a word (punctuation and case do not count)
    split: Literal["train", "eval"]


@dataclass(frozen=True)
class MerlinText:
    author: str
    level: str
    l1: str
    task: str
    learner: str
    target: str  # target hypothesis 1, space-tokenised


def parse_text(text: str) -> MerlinText:
    """One file of `meta_ltext_THs`: metadata, the learner text and target hypothesis 1."""
    meta = {k.strip(): v.strip() for k, v in _META.findall(text)}
    learner = text.split("Learner text:", 1)[1].split("----------------", 1)[0]
    target = text.split("Target hypothesis 1:", 1)[1].split("----------------", 1)[0]
    task = meta.get("Task", "").split(" - ID:", 1)[0]
    return MerlinText(
        author=meta.get("Author ID", ""),
        level=meta.get("Overall CEFR rating", ""),
        l1=meta.get("Mother tongue", ""),
        task=task,
        learner=_clean(learner),
        target=_clean(target),
    )


def _clean(text: str) -> str:
    return " ".join(text.translate(_APOSTROPHES).split())


def _tokens(text: str) -> list[str]:
    return _TOKEN.findall(text)


def words(text: str) -> list[str]:
    return [w.lower() for w in _WORD.findall(text)]


def detokenize(tokens: Iterable[str]) -> str:
    """Join tokens with normal Italian spacing ("l' annuncio ." -> "l'annuncio.")."""
    text = " ".join(tokens)
    text = re.sub(r" ([.,;:!?)])", r"\1", text)
    text = re.sub(r"\( ", "(", text)
    text = re.sub(r"(\w') ", r"\1", text)
    return re.sub(r'" ([^"]*?) "', r'"\1"', text)


def sentence_pairs(item: MerlinText) -> Iterator[tuple[str, str]]:
    """Align learner and target tokens, and cut both at the target's sentence ends."""
    learner = _tokens(item.learner)
    target = item.target.split()
    matcher = difflib.SequenceMatcher(
        a=[t.lower() for t in learner], b=[t.lower() for t in target], autojunk=False
    )
    # For each target position, the first learner position that lines up with it, so learner
    # words the native corrector deleted stay in the sentence that follows them.
    to_learner: list[int | None] = [None] * (len(target) + 1)
    for tag, i1, _i2, j1, j2 in matcher.get_opcodes():
        for j in range(j1, j2 + 1):
            if to_learner[j] is None:
                to_learner[j] = i1 + (j - j1) if tag == "equal" else i1
    bounds = [len(learner) if i is None else i for i in to_learner]
    start = 0
    for j, token in enumerate(target):
        if token in _SENTENCE_END or j == len(target) - 1:
            a, b = bounds[start], bounds[j + 1]
            if a < b:
                yield detokenize(learner[a:b]), detokenize(target[start : j + 1])
            start = j + 1


def split_for(author: str) -> Literal["train", "eval"]:
    digest = int(hashlib.sha256(author.encode()).hexdigest()[:8], 16)
    return "eval" if digest % EVAL_SHARE == 0 else "train"


def _usable(learner: str, native: str) -> bool:
    lw, nw = words(learner), words(native)
    if not MIN_WORDS <= len(nw) <= MAX_WORDS or not lw:
        return False
    if not MIN_RATIO <= len(lw) / len(nw) <= MAX_RATIO:
        return False
    return not (_PLACEHOLDER.search(learner) or _PLACEHOLDER.search(native))


def pairs_from_text(item: MerlinText) -> list[LearnerPair]:
    if item.level not in LEVELS or not item.author:
        return []
    out: list[LearnerPair] = []
    for learner, native in sentence_pairs(item):
        if not _usable(learner, native):
            continue
        out.append(
            LearnerPair(
                id=f"merlin-{item.author}-{len(out)}",
                author=item.author,
                level=Level(item.level),
                l1=item.l1,
                task=item.task,
                learner=learner,
                native=native,
                changed=words(learner) != words(native),
                split=split_for(item.author),
            )
        )
    return out


def pairs_from_zip(path: Path) -> list[LearnerPair]:
    """Every usable sentence pair of the Italian part of `merlin-text-v1.2.zip`."""
    out: list[LearnerPair] = []
    with zipfile.ZipFile(path) as archive:
        names = sorted(
            n for n in archive.namelist() if n.startswith(MERLIN_TEXTS) and n.endswith(".txt")
        )
        for name in names:
            out += pairs_from_text(parse_text(archive.read(name).decode("utf-8")))
    return out


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def fetch_merlin(dest: Path, url: str = MERLIN_URL) -> Path:
    """Download the pinned MERLIN text release (12 MB) unless it is already there; verify it."""
    if not dest.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        partial = dest.with_suffix(".part")
        urllib.request.urlretrieve(url, partial)
        partial.rename(dest)
    actual = sha256_of(dest)
    if actual != MERLIN_SHA256:
        raise ValueError(f"{dest}: sha256 {actual} does not match the pinned release")
    return dest
