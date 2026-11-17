"""Audio pack format: shards of clips with an index, packed as ``.tar.zst``.

A pack (one manifest entry of kind ``audio-pack``) is a list of shard archives. Each shard
unpacks to ``<shard>/index.json`` and ``<shard>/<k0k1>/<key>.m4a``. Shards are append-only:
a rebuild adds a new shard holding only the clips that earlier shards lack, so a phone that
has the pack downloads just the new shard when content grows.

``index.json`` (format 1)::

    {
      "format": 1,
      "pack": "audio-voice-sara",
      "shard": "s000",
      "voice": {"id": "kokoro-if_sara", "name": "Sara", "gender": "female", "native": false},
      "clips": {
        "<key>": [{"f": "ab/ab12....m4a", "ms": 1830, "w": [[0, 4, 120, 380], ...],
                   "by": "Sara", "lic": "Apache-2.0", "src": "..."}]
      }
    }

``w`` (optional) holds word timings as ``[charStart, charEnd, startMs, endMs]`` over the
normalised text. ``by``, ``lic`` and ``src`` credit recordings by real people.
"""

from __future__ import annotations

import io
import json
import tarfile
from collections.abc import Iterable, Sequence
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, TypeVar

FORMAT = 1
ZSTD_LEVEL = 10

T = TypeVar("T")


@dataclass(frozen=True)
class VoiceInfo:
    """Who speaks a pack's clips (``native`` packs hold recordings by several real people)."""

    id: str
    name: str
    gender: str
    native: bool


@dataclass
class Clip:
    """One recording of one utterance."""

    f: str
    ms: int
    w: list[list[int]] | None = None
    by: str | None = None
    lic: str | None = None
    src: str | None = None

    def to_json(self) -> dict[str, Any]:
        return {k: v for k, v in asdict(self).items() if v is not None}


@dataclass
class ShardIndex:
    pack: str
    shard: str
    voice: VoiceInfo
    clips: dict[str, list[Clip]] = field(default_factory=dict)

    def to_json(self) -> dict[str, Any]:
        return {
            "format": FORMAT,
            "pack": self.pack,
            "shard": self.shard,
            "voice": asdict(self.voice),
            "clips": {k: [c.to_json() for c in v] for k, v in sorted(self.clips.items())},
        }

    @staticmethod
    def from_json(data: dict[str, Any]) -> ShardIndex:
        if data.get("format") != FORMAT:
            raise ValueError(f"Unsupported shard index format {data.get('format')!r}")
        return ShardIndex(
            pack=data["pack"],
            shard=data["shard"],
            voice=VoiceInfo(**data["voice"]),
            clips={k: [Clip(**c) for c in v] for k, v in data["clips"].items()},
        )


def clip_path(key: str) -> str:
    """Path of a clip inside its shard folder."""
    return f"{key[:2]}/{key}.m4a"


def shard_name(number: int) -> str:
    return f"s{number:03d}"


def next_shard(existing: Iterable[str]) -> str:
    """The name after the highest existing shard (``s000`` for a new pack)."""
    numbers = [int(name[1:4]) for name in existing]
    return shard_name(max(numbers) + 1 if numbers else 0)


def todo(keys: Iterable[str], have: set[str]) -> list[str]:
    """Keys not in any published shard, in input order."""
    return [k for k in keys if k not in have]


def part(items: Sequence[T], index: int, count: int) -> list[T]:
    """Every ``count``-th item starting at ``index``: an even split for parallel jobs."""
    if not 0 <= index < count:
        raise ValueError(f"part {index} of {count}")
    return list(items[index::count])


def _add_bytes(tar: tarfile.TarFile, name: str, data: bytes) -> None:
    info = tarfile.TarInfo(name)
    info.size = len(data)
    info.mtime = 0
    info.mode = 0o644
    tar.addfile(info, io.BytesIO(data))


def _add_dir(tar: tarfile.TarFile, name: str) -> None:
    info = tarfile.TarInfo(name)
    info.type = tarfile.DIRTYPE
    info.mtime = 0
    info.mode = 0o755
    tar.addfile(info)


def write_shard(index: ShardIndex, clips_dir: Path, out: Path) -> None:
    """Write a shard archive: ``<shard>/index.json`` then every clip file, sorted, reproducibly.

    ``clips_dir`` holds the clip files at their :func:`clip_path` locations.
    """
    import zstandard

    files = sorted({c.f for clips in index.clips.values() for c in clips})
    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode="w", format=tarfile.USTAR_FORMAT) as tar:
        _add_dir(tar, index.shard)
        _add_bytes(
            tar,
            f"{index.shard}/index.json",
            json.dumps(index.to_json(), ensure_ascii=False, separators=(",", ":")).encode(),
        )
        for sub in sorted({f.split("/")[0] for f in files}):
            _add_dir(tar, f"{index.shard}/{sub}")
        for f in files:
            _add_bytes(tar, f"{index.shard}/{f}", (clips_dir / f).read_bytes())
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(zstandard.ZstdCompressor(level=ZSTD_LEVEL).compress(raw.getvalue()))
