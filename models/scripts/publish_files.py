"""Upload every file in `models/manifest.json` to the project's Hugging Face repository.

The app downloads its models, voices and CPU-specific engine builds after install, and only
the ones the phone can use. This script puts all of them in one place we control, a public
Hugging Face model repository (free storage and bandwidth, no file size limit, resumable range
downloads), and points the manifest at it:

1. For each file, take it from a local folder (files we build: the phonemizer export, the
   fine-tuned tutor GGUF, llama.rn's engine libraries) or from its current URL (upstream
   models), check its size and SHA-256 against the manifest, and upload it as
   ``<model id>/<file name>``. A file already in the repository with the same SHA-256 is
   skipped, so the script can be re-run after a failure or when one model changes.
2. Rewrite each published file's ``url`` to the repository commit it is in (a pinned,
   immutable URL) and mark it ``available``. Files that could not be found stay as they were.

The manifest's checksums are never changed: a file that does not match is an error.

Usage (needs ``huggingface_hub`` >= 0.34 and a write token in ``HF_TOKEN``):

    python -I models/scripts/publish_files.py --repo OWNER/italia-models \\
        --local-dir PATH ... [--only ID ...] [--dry-run]

``--local-dir`` may be given several times; each is searched for ``<name>`` and
``<abi>/<name>`` (the layout of llama.rn's ``android/src/main/jniLibs``).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sys
import tempfile
import urllib.request
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
MANIFEST = REPO_ROOT / "models" / "manifest.json"
HF = "https://huggingface.co"
CHUNK = 8 * 1024 * 1024


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        while chunk := fh.read(CHUNK):
            digest.update(chunk)
    return digest.hexdigest()


def repo_path(model: dict[str, Any], file: dict[str, Any]) -> str:
    return f"{model['id']}/{file['name']}"


def pinned_url(repo: str, revision: str, path: str) -> str:
    return f"{HF}/{repo}/resolve/{revision}/{path}"


def find_local(file: dict[str, Any], model: dict[str, Any], dirs: list[Path]) -> Path | None:
    abi = (model.get("cpu") or {}).get("abi")
    for base in dirs:
        for candidate in [base / file["name"], *([base / abi / file["name"]] if abi else [])]:
            if candidate.is_file():
                return candidate
    return None


def download(url: str, dest: Path) -> None:
    request = urllib.request.Request(url, headers={"User-Agent": "italia-publish-files"})
    with urllib.request.urlopen(request) as response, dest.open("wb") as out:  # noqa: S310
        shutil.copyfileobj(response, out, CHUNK)


def check(path: Path, file: dict[str, Any]) -> None:
    size = path.stat().st_size
    if size != file["sizeBytes"]:
        raise SystemExit(f"{file['name']}: {size} bytes, manifest says {file['sizeBytes']}")
    digest = sha256_file(path)
    if digest != file["sha256"]:
        raise SystemExit(f"{file['name']}: SHA-256 {digest}, manifest says {file['sha256']}")


def remote_hashes(api: Any, repo: str, paths: list[str]) -> dict[str, str]:
    """SHA-256 of each path already in the repository (LFS/Xet files only)."""
    from huggingface_hub.hf_api import RepoFile

    found: dict[str, str] = {}
    for i in range(0, len(paths), 50):
        for info in api.get_paths_info(repo, paths[i : i + 50], repo_type="model"):
            if isinstance(info, RepoFile) and info.lfs is not None:
                found[info.path] = info.lfs.sha256
    return found


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--repo", required=True, help="Hugging Face repo id, OWNER/NAME")
    parser.add_argument("--local-dir", action="append", type=Path, default=[])
    parser.add_argument("--only", action="append", default=[], help="model id (repeatable)")
    parser.add_argument("--manifest", type=Path, default=MANIFEST)
    parser.add_argument("--dry-run", action="store_true", help="say what would be uploaded")
    args = parser.parse_args(argv)

    from huggingface_hub import HfApi

    api = HfApi(token=os.environ.get("HF_TOKEN"))
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    models = [m for m in manifest["models"] if not args.only or m["id"] in args.only]
    if args.only and len(models) != len(set(args.only)):
        raise SystemExit(f"Unknown model id in {args.only}")
    if not args.dry_run:
        api.create_repo(args.repo, repo_type="model", exist_ok=True, private=False)

    wanted = [repo_path(m, f) for m in models for f in m["files"]]
    present = remote_hashes(api, args.repo, wanted) if not args.dry_run else {}
    published: set[str] = set()
    missing: list[str] = []

    for model in models:
        for file in model["files"]:
            path = repo_path(model, file)
            if present.get(path) == file["sha256"]:
                print(f"= {path} (already uploaded)")
                published.add(path)
                continue
            local = find_local(file, model, args.local_dir)
            upstream = file["url"] if not file["url"].startswith(f"{HF}/{args.repo}/") else None
            if local is None and (upstream is None or file.get("available") is False):
                print(f"! {path}: no local copy and no upstream URL; skipped")
                missing.append(path)
                continue
            if args.dry_run:
                print(f"+ {path} from {local or upstream}")
                continue
            with tempfile.TemporaryDirectory() as tmp:
                source = local
                if source is None:
                    source = Path(tmp) / file["name"]
                    print(f"  downloading {upstream}")
                    download(upstream, source)
                check(source, file)
                print(f"+ {path} ({file['sizeBytes']} bytes)")
                api.upload_file(
                    path_or_fileobj=str(source),
                    path_in_repo=path,
                    repo_id=args.repo,
                    repo_type="model",
                    commit_message=f"Add {path}",
                )
            published.add(path)

    if args.dry_run:
        return 0
    revision = api.model_info(args.repo).sha
    for model in models:
        for file in model["files"]:
            path = repo_path(model, file)
            if path in published:
                file["url"] = pinned_url(args.repo, revision, path)
                file.pop("available", None)
    args.manifest.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", "utf-8")
    print(f"Manifest points at {args.repo}@{revision}; {len(published)} files published.")
    if missing:
        print("Not published (no source):\n  " + "\n  ".join(missing), file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
