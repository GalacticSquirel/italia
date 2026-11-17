"""Recordings of single words by native speakers, from Lingua Libre (Wikimedia Commons).

Lingua Libre files are named ``LL-Q652 (ita)-<speaker>-<word>.wav``. We list the Italian
category, keep files whose word is one of our lemmas (up to :data:`PER_WORD` speakers each,
most prolific speakers first), and read each file's licence and author from Commons, so the
app can credit them. Commons asks automated clients to identify themselves, go slowly and
back off when told to; :class:`Commons` does that.
"""

from __future__ import annotations

import json
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from pathlib import Path
from typing import Any

API = "https://commons.wikimedia.org/w/api.php"
CATEGORY = "Category:Lingua_Libre_pronunciation-ita"
USER_AGENT = "italia-audio-build/1.0 (https://github.com/GalacticSquirel/italia)"
PER_WORD = 2
#: Licences we may redistribute (Commons short names).
ALLOWED_LICENCES = {
    "CC BY-SA 4.0",
    "CC BY-SA 3.0",
    "CC BY 4.0",
    "CC BY 3.0",
    "CC0",
    "Public domain",
}

_TITLE = re.compile(r"^File:LL-Q652 \(ita\)-(?P<speaker>[^-]+)-(?P<word>.+)\.(?:wav|ogg|flac|mp3)$")


@dataclass(frozen=True)
class Recording:
    title: str
    speaker: str
    word: str
    url: str = ""
    licence: str = ""
    author: str = ""


def word_of(text: str) -> str:
    return unicodedata.normalize("NFC", text).strip().lower()


def parse_title(title: str) -> Recording | None:
    m = _TITLE.match(title)
    if not m:
        return None
    return Recording(title=title, speaker=m["speaker"], word=word_of(m["word"]))


def choose(
    recordings: Iterable[Recording], words: set[str], per_word: int = PER_WORD
) -> list[Recording]:
    """Up to ``per_word`` recordings by different speakers for each wanted word.

    Speakers with more recordings are preferred (their sessions are usually cleaner and more
    consistent), ties broken by name so the choice is stable.
    """
    by_word: dict[str, list[Recording]] = defaultdict(list)
    output = [r for r in recordings if r.word in words]
    counts = Counter(r.speaker for r in output)
    for r in output:
        by_word[r.word].append(r)
    chosen: list[Recording] = []
    for word in sorted(by_word):
        seen: set[str] = set()
        for r in sorted(by_word[word], key=lambda r: (-counts[r.speaker], r.speaker, r.title)):
            if r.speaker in seen:
                continue
            seen.add(r.speaker)
            chosen.append(r)
            if len(seen) == per_word:
                break
    return chosen


class Commons:
    """A polite Commons client: identifies itself, waits between calls, retries on 429/5xx."""

    def __init__(self, pause: float = 1.0) -> None:
        self.pause = pause
        self._last = 0.0

    def _open(self, request: urllib.request.Request) -> bytes:
        for attempt in range(8):
            wait = self._last + self.pause - time.monotonic()
            if wait > 0:
                time.sleep(wait)
            self._last = time.monotonic()
            try:
                with urllib.request.urlopen(request, timeout=120) as response:
                    data: bytes = response.read()
                    return data
            except urllib.error.HTTPError as e:
                if e.code not in (429, 500, 502, 503, 504):
                    raise
                retry = e.headers.get("Retry-After")
                time.sleep(float(retry) if retry and retry.isdigit() else 10 * 2**attempt)
            except urllib.error.URLError:
                time.sleep(10 * 2**attempt)
        raise RuntimeError(f"Commons kept refusing {request.full_url}")

    def api(self, params: dict[str, str]) -> dict[str, Any]:
        body = urllib.parse.urlencode({**params, "format": "json", "maxlag": "5"}).encode()
        request = urllib.request.Request(API, data=body, headers={"User-Agent": USER_AGENT})
        result: dict[str, Any] = json.loads(self._open(request))
        return result

    def download(self, url: str) -> bytes:
        return self._open(urllib.request.Request(url, headers={"User-Agent": USER_AGENT}))

    def titles(self) -> Iterator[str]:
        params = {
            "action": "query",
            "list": "categorymembers",
            "cmtitle": CATEGORY,
            "cmtype": "file",
            "cmlimit": "500",
        }
        while True:
            data = self.api(params)
            for member in data["query"]["categorymembers"]:
                yield member["title"]
            if "continue" not in data:
                return
            params.update(data["continue"])

    def details(self, recordings: list[Recording]) -> list[Recording]:
        """Fill in URL, licence and author (50 files per call)."""
        out: list[Recording] = []
        for i in range(0, len(recordings), 50):
            batch = {r.title: r for r in recordings[i : i + 50]}
            data = self.api(
                {
                    "action": "query",
                    "prop": "imageinfo",
                    "titles": "|".join(batch),
                    "iiprop": "url|extmetadata",
                    "iiextmetadatafilter": "LicenseShortName|Artist",
                }
            )
            for page in data["query"]["pages"].values():
                info = (page.get("imageinfo") or [None])[0]
                rec = batch.get(page.get("title", ""))
                if not info or not rec:
                    continue
                meta = info.get("extmetadata", {})
                author = re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", "")).strip()
                out.append(
                    Recording(
                        title=rec.title,
                        speaker=rec.speaker,
                        word=rec.word,
                        url=info["url"],
                        licence=meta.get("LicenseShortName", {}).get("value", ""),
                        author=author or rec.speaker,
                    )
                )
        return out


def plan(words: set[str], out: Path, client: Commons | None = None) -> list[Recording]:
    """List, choose and describe recordings for ``words``; writes them to ``out`` as JSON."""
    client = client or Commons()
    listed = [r for t in client.titles() if (r := parse_title(t))]
    chosen = choose(listed, words)
    described = [r for r in client.details(chosen) if r.licence in ALLOWED_LICENCES]
    out.write_text(json.dumps([r.__dict__ for r in described], ensure_ascii=False, indent=1))
    return described


def load_plan(path: Path) -> list[Recording]:
    return [Recording(**r) for r in json.loads(path.read_text("utf-8"))]
