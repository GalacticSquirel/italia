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


def manifest_entry(path: Path, *, model_id: str, url: str, licence: str) -> dict[str, Any]:
    return {
        "id": model_id,
        "url": url,
        "sha256": sha256_file(path),
        "sizeBytes": path.stat().st_size,
        "licence": licence,
    }


def validate_manifest(manifest: dict[str, Any], schema_path: Path = MANIFEST_SCHEMA) -> None:
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    jsonschema.validate(manifest, schema, format_checker=jsonschema.FormatChecker())


def upsert_entry(
    entry: dict[str, Any],
    manifest_path: Path = MANIFEST,
    schema_path: Path = MANIFEST_SCHEMA,
) -> dict[str, Any]:
    """Insert or replace the entry with the same id, validate, and write the manifest."""
    manifest: dict[str, Any] = json.loads(manifest_path.read_text(encoding="utf-8"))
    models = [m for m in manifest["models"] if m["id"] != entry["id"]]
    models.append(entry)
    manifest["models"] = sorted(models, key=lambda m: m["id"])
    validate_manifest(manifest, schema_path)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest
