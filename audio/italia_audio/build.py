"""Command line for building and publishing audio packs. Run ``python -m italia_audio --help``.

The GitHub workflow ``.github/workflows/audio-packs.yml`` runs the stages in order:

1. ``plan``: for each pack, the utterances no published shard has yet (read from the shard
   indexes next to the archives on Hugging Face), plus the native word recordings to fetch.
2. ``synth --pack P --part i --parts n``: record one slice of a pack's plan (parallel jobs).
3. ``assemble --pack P``: merge the slices into the pack's next shard archive and add it to
   ``models/manifest.json`` (not yet available; ``publish_files.py`` uploads and enables it).
4. ``upload-indexes``: put each new shard's index beside its archive, for the next ``plan``.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from . import content, native
from .encode import SAMPLE_RATE, decode, duration_ms, prepare, write_m4a
from .pack import Clip, ShardIndex, clip_path, next_shard, part, todo, write_shard
from .voices import PACKS, synthesiser

REPO_ROOT = content.REPO_ROOT
MANIFEST = REPO_ROOT / "models" / "manifest.json"
BUILD_DIR = REPO_ROOT / "models" / "build" / "audio"
HF = "https://huggingface.co"


# --- published state --------------------------------------------------------------------------


def manifest_entry(manifest: dict[str, Any], pack_id: str) -> dict[str, Any] | None:
    return next((m for m in manifest["models"] if m["id"] == pack_id), None)


def shard_of(file_name: str) -> str:
    """``audio-voice-sara-s003.tar.zst`` -> ``s003``."""
    return file_name.removesuffix(".tar.zst").rsplit("-", 1)[-1]


def archive_name(pack_id: str, shard: str) -> str:
    return f"{pack_id}-{shard}.tar.zst"


def index_name(pack_id: str, shard: str) -> str:
    return f"{pack_id}-{shard}.index.json"


def fetch_json(url: str) -> dict[str, Any]:
    request = urllib.request.Request(url, headers={"User-Agent": native.USER_AGENT})
    with urllib.request.urlopen(request, timeout=120) as response:
        data: dict[str, Any] = json.loads(response.read())
        return data


def published(manifest: dict[str, Any], pack_id: str, repo: str) -> tuple[list[str], set[str]]:
    """Shards in the manifest for a pack and the clip keys they hold."""
    entry = manifest_entry(manifest, pack_id)
    if entry is None:
        return [], set()
    shards = [shard_of(f["name"]) for f in entry["files"]]
    keys: set[str] = set()
    for shard in shards:
        local = BUILD_DIR / pack_id / index_name(pack_id, shard)
        if local.exists():
            data = json.loads(local.read_text("utf-8"))
        else:
            data = fetch_json(f"{HF}/{repo}/resolve/main/{pack_id}/{index_name(pack_id, shard)}")
        keys.update(data["clips"])
    return shards, keys


# --- stages -----------------------------------------------------------------------------------


def plan_dir(work: Path) -> Path:
    return work / "plan"


def cmd_plan(args: argparse.Namespace) -> int:
    manifest = json.loads(MANIFEST.read_text("utf-8"))
    utterances = content.load()
    out = plan_dir(args.work)
    out.mkdir(parents=True, exist_ok=True)
    matrix: list[dict[str, Any]] = []
    for spec in PACKS.values():
        if args.only and spec.id not in args.only:
            continue
        _, have = published(manifest, spec.id, args.repo)
        wanted = [u for u in utterances if u.kind in spec.kinds]
        if args.limit:
            wanted = wanted[: args.limit]
        keys = set(todo([u.key for u in wanted], have))
        items = [u.__dict__ for u in wanted if u.key in keys]
        (out / f"{spec.id}.json").write_text(json.dumps(items, ensure_ascii=False))
        if spec.native and items:
            native.plan({u["text"].lower() for u in items}, out / f"{spec.id}.native.json")
        parts = max(1, min(args.max_parts, -(-len(items) // args.per_part))) if items else 0
        matrix += [{"pack": spec.id, "part": i, "parts": parts} for i in range(parts)]
        print(f"{spec.id}: {len(items)} to record in {parts} parts ({len(have)} published)")
    (out / "matrix.json").write_text(json.dumps(matrix))
    print(json.dumps({"include": matrix}))
    return 0


def cmd_synth(args: argparse.Namespace) -> int:
    spec = PACKS[args.pack]
    items = json.loads((plan_dir(args.work) / f"{spec.id}.json").read_text("utf-8"))
    mine = part(items, args.part, args.parts)
    out = args.work / "out" / spec.id
    clips_dir = out / "clips"
    result: dict[str, list[Clip]] = {}

    recordings: dict[str, list[native.Recording]] = {}
    native_plan = plan_dir(args.work) / f"{spec.id}.native.json"
    if spec.native and native_plan.exists():
        for rec in native.load_plan(native_plan):
            recordings.setdefault(rec.word, []).append(rec)

    client = native.Commons() if recordings else None
    synth = None
    aligner = None
    if any(u["kind"] in spec.timed for u in mine):
        from .align import Aligner

        aligner = Aligner()

    for n, item in enumerate(mine, 1):
        key, text, kind = item["key"], item["text"], item["kind"]
        clips: list[Clip] = []
        for i, rec in enumerate(recordings.get(text.lower(), [])):
            assert client is not None
            try:
                with tempfile.NamedTemporaryFile(suffix=Path(rec.url).suffix) as tmp:
                    tmp.write(client.download(rec.url))
                    tmp.flush()
                    audio = prepare(decode(Path(tmp.name)), SAMPLE_RATE)
            except Exception as error:  # a broken upload must not stop the build
                print(f"  skipped {rec.title}: {error}", file=sys.stderr)
                continue
            name = clip_path(key).replace(".m4a", f"-{i}.m4a")
            write_m4a(audio, clips_dir / name)
            clips.append(
                Clip(
                    f=name,
                    ms=duration_ms(audio),
                    by=rec.author,
                    lic=rec.licence,
                    src=f"https://commons.wikimedia.org/wiki/{rec.title.replace(' ', '_')}",
                )
            )
        if not clips:
            if synth is None:
                synth = synthesiser(spec.voice.id, args.work / "voices")
            samples, rate = synth(text)
            audio = prepare(samples, rate)
            timings = (
                aligner.timings(text, audio, SAMPLE_RATE)
                if aligner and kind in spec.timed
                else None
            )
            write_m4a(audio, clips_dir / clip_path(key))
            clips.append(Clip(f=clip_path(key), ms=duration_ms(audio), w=timings or None))
        result[key] = clips
        if n % 100 == 0:
            print(f"{spec.id} part {args.part}: {n}/{len(mine)}", flush=True)
    (out / f"part-{args.part}.json").write_text(
        json.dumps({k: [c.to_json() for c in v] for k, v in result.items()}, ensure_ascii=False)
    )
    print(f"{spec.id} part {args.part}: {len(result)} clips")
    return 0


def cmd_assemble(args: argparse.Namespace) -> int:
    spec = PACKS[args.pack]
    out = args.work / "out" / spec.id
    clips: dict[str, list[Clip]] = {}
    for path in sorted(out.glob("part-*.json")):
        for key, items in json.loads(path.read_text("utf-8")).items():
            clips[key] = [Clip(**c) for c in items]
    if not clips:
        print(f"{spec.id}: nothing new")
        return 0
    manifest = json.loads(MANIFEST.read_text("utf-8"))
    entry = manifest_entry(manifest, spec.id)
    shard = next_shard(shard_of(f["name"]) for f in (entry or {}).get("files", []))
    index = ShardIndex(pack=spec.id, shard=shard, voice=spec.voice, clips=clips)
    dest = BUILD_DIR / spec.id
    archive = dest / archive_name(spec.id, shard)
    write_shard(index, out / "clips", archive)
    (dest / index_name(spec.id, shard)).write_text(
        json.dumps(index.to_json(), ensure_ascii=False, separators=(",", ":"))
    )
    import hashlib

    file = {
        "name": archive.name,
        "url": f"{HF}/{args.repo}/resolve/main/{spec.id}/{archive.name}",
        "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
        "sizeBytes": archive.stat().st_size,
        "verification": "built",
        "extract": "tar.zst",
        "available": False,
    }
    if entry is None:
        entry = {
            "id": spec.id,
            "kind": "audio-pack",
            "title": spec.title,
            "description": spec.description,
            "licence": spec.licence,
            "source": spec.source,
            "minRamBytes": 0,
            "files": [],
        }
        manifest["models"].append(entry)
    entry["files"].append(file)
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", "utf-8")
    print(f"{spec.id}: {archive.name}, {len(clips)} clips, {file['sizeBytes']} bytes")
    return 0


def cmd_upload_indexes(args: argparse.Namespace) -> int:
    from huggingface_hub import HfApi

    api = HfApi(token=os.environ.get("HF_TOKEN"))
    for path in sorted(BUILD_DIR.glob("*/*.index.json")):
        pack_id = path.parent.name
        api.upload_file(
            path_or_fileobj=str(path),
            path_in_repo=f"{pack_id}/{path.name}",
            repo_id=args.repo,
            repo_type="model",
            commit_message=f"Add {pack_id}/{path.name}",
        )
        print(f"+ {pack_id}/{path.name}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="italia_audio", description=__doc__.split("\n\n")[0])
    parser.add_argument("--work", type=Path, default=Path("work"))
    parser.add_argument(
        "--repo", default=os.environ.get("HF_MODELS_REPO", "oweng-06/italia-models")
    )
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("plan", help="what each pack still needs")
    p.add_argument("--only", action="append", default=[], help="pack id (repeatable)")
    p.add_argument("--limit", type=int, default=0, help="first N utterances per pack (trials)")
    p.add_argument("--per-part", type=int, default=1200)
    p.add_argument("--max-parts", type=int, default=12)
    p.set_defaults(run=cmd_plan)
    s = sub.add_parser("synth", help="record one slice of a pack's plan")
    s.add_argument("--pack", required=True, choices=sorted(PACKS))
    s.add_argument("--part", type=int, required=True)
    s.add_argument("--parts", type=int, required=True)
    s.set_defaults(run=cmd_synth)
    a = sub.add_parser("assemble", help="pack the slices into the next shard")
    a.add_argument("--pack", required=True, choices=sorted(PACKS))
    a.set_defaults(run=cmd_assemble)
    u = sub.add_parser("upload-indexes", help="upload new shard indexes beside their archives")
    u.set_defaults(run=cmd_upload_indexes)
    args = parser.parse_args(argv)
    result: int = args.run(args)
    return result
