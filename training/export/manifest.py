"""SHA-256, size and a `models/manifest.json` entry for an exported GGUF.

The app downloads models from `url`, checks `sizeBytes` and `sha256` before loading, and
shows `licence`. The weights themselves are never committed.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import jsonschema

from datagen.lemmas import TRAINING_DIR

REPO_ROOT = TRAINING_DIR.parent
MANIFEST = REPO_ROOT / "models" / "manifest.json"
MANIFEST_SCHEMA = REPO_ROOT / "models" / "manifest.schema.json"


def sha256_file(path: Path, chunk_size: int = 8 * 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        while chunk := fh.read(chunk_size):
            digest.update(chunk)
    return digest.hexdigest()


GIB = 1024**3

TIER_MIN_RAM_BYTES = {"e4b": 11 * GIB, "e2b": 7 * GIB}
"""Least device RAM per tutor size, matching the app's device tiers (`models/capability.ts`):
E4B on 12 GB phones (the `high` tier), E2B on 8 GB phones (`mid`)."""


def min_ram_for(model_id: str) -> int:
    """The RAM floor for a tutor model id (E2B when the id says so, else E4B)."""
    return TIER_MIN_RAM_BYTES["e2b" if "e2b" in model_id.lower() else "e4b"]


def manifest_entry(
    path: Path,
    *,
    model_id: str,
    url: str,
    licence: str,
    title: str = "Conversation partner",
    description: str | None = None,
    source: str = "https://huggingface.co/google",
    min_ram_bytes: int | None = None,
) -> dict[str, Any]:
    """A manifest (format 2) entry for one exported GGUF of kind `llm`.

    The app picks the largest installed `llm` model the phone can run as the tutor, so a
    fine-tuned GGUF replaces the base model by giving it the base model's entry's place.
    """
    return {
        "id": model_id,
        "kind": "llm",
        "title": title,
        "description": description
        or f"The Italian tutor for conversations ({model_id}), fine-tuned for this app.",
        "licence": licence,
        "source": source,
        "minRamBytes": min_ram_bytes if min_ram_bytes is not None else min_ram_for(model_id),
        "files": [
            {
                "name": path.name,
                "url": url,
                "sha256": sha256_file(path),
                "sizeBytes": path.stat().st_size,
                "verification": "built",
            }
        ],
        # Run by llama.rn; the app downloads the engine build for the phone's CPU with it.
        "needsEngine": "llama",
    }


def validate_manifest(manifest: dict[str, Any], schema_path: Path = MANIFEST_SCHEMA) -> None:
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    jsonschema.validate(manifest, schema, format_checker=jsonschema.FormatChecker())


def upsert_entry(
    entry: dict[str, Any],
    manifest_path: Path = MANIFEST,
    schema_path: Path = MANIFEST_SCHEMA,
) -> dict[str, Any]:
    """Replace the entry with the same id in place (or append it), validate, and write."""
    manifest: dict[str, Any] = json.loads(manifest_path.read_text(encoding="utf-8"))
    models: list[dict[str, Any]] = list(manifest["models"])
    ids = [m["id"] for m in models]
    if entry["id"] in ids:
        models[ids.index(entry["id"])] = entry
    else:
        models.append(entry)
    manifest["models"] = models
    validate_manifest(manifest, schema_path)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest
