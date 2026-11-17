import io
import json
import tarfile
from pathlib import Path

import pytest
import zstandard

from italia_audio.pack import (
    Clip,
    ShardIndex,
    VoiceInfo,
    clip_path,
    next_shard,
    part,
    todo,
    write_shard,
)

VOICE = VoiceInfo(id="v", name="V", gender="female", native=False)


def test_shard_names_and_planning() -> None:
    assert next_shard([]) == "s000"
    assert next_shard(["s000", "s002"]) == "s003"
    assert todo(["a", "b", "c"], {"b"}) == ["a", "c"]
    assert part([1, 2, 3, 4, 5], 1, 2) == [2, 4]
    with pytest.raises(ValueError):
        part([1], 2, 2)
    assert clip_path("abcdef0123456789") == "ab/abcdef0123456789.m4a"


def test_index_round_trip() -> None:
    index = ShardIndex("p", "s000", VOICE, {"k": [Clip(f="k.m4a", ms=10, w=[[0, 1, 2, 3]])]})
    data = json.loads(json.dumps(index.to_json()))
    assert data["clips"]["k"] == [{"f": "k.m4a", "ms": 10, "w": [[0, 1, 2, 3]]}]
    assert ShardIndex.from_json(data) == index
    with pytest.raises(ValueError):
        ShardIndex.from_json({**data, "format": 9})


def test_write_shard_is_reproducible(tmp_path: Path) -> None:
    clips = tmp_path / "clips"
    (clips / "ab").mkdir(parents=True)
    (clips / "ab" / "ab00.m4a").write_bytes(b"audio")
    index = ShardIndex("p", "s001", VOICE, {"ab00": [Clip(f="ab/ab00.m4a", ms=5)]})
    write_shard(index, clips, tmp_path / "one.tar.zst")
    write_shard(index, clips, tmp_path / "two.tar.zst")
    assert (tmp_path / "one.tar.zst").read_bytes() == (tmp_path / "two.tar.zst").read_bytes()
    raw = zstandard.ZstdDecompressor().decompress((tmp_path / "one.tar.zst").read_bytes())
    with tarfile.open(fileobj=io.BytesIO(raw)) as tar:
        assert tar.getnames() == ["s001", "s001/index.json", "s001/ab", "s001/ab/ab00.m4a"]
        member = tar.extractfile("s001/ab/ab00.m4a")
        assert member is not None and member.read() == b"audio"
