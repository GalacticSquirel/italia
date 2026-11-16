"""Robust JSON helpers: pull one JSON object out of model text, and JSONL files."""

from __future__ import annotations

import json
import threading
from collections.abc import Iterable, Iterator
from pathlib import Path
from typing import Any


class JsonExtractError(ValueError):
    pass


def extract_json_object(text: str) -> dict[str, Any]:
    """The first complete top-level JSON object in `text` (code fences and prose are ignored)."""
    start = text.find("{")
    while start != -1:
        end = _match_brace(text, start)
        if end is not None:
            try:
                value = json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                value = None
            if isinstance(value, dict):
                return value
        start = text.find("{", start + 1)
    raise JsonExtractError("no JSON object found in model output")


def _match_brace(text: str, start: int) -> int | None:
    depth = 0
    in_string = False
    escaped = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
        elif ch == '"':
            in_string = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i
    return None


def read_jsonl(path: Path) -> Iterator[dict[str, Any]]:
    """Rows of a JSONL file; a truncated last line (from an interrupted run) is skipped."""
    if not path.exists():
        return
    with path.open(encoding="utf-8") as fh:
        for raw_line in fh:
            line = raw_line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(row, dict):
                yield row


def write_jsonl(path: Path, rows: Iterable[dict[str, Any]]) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as fh:
        for row in rows:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
            count += 1
    tmp.replace(path)
    return count


class JsonlAppender:
    """Thread-safe append-and-flush writer, so an interrupted run loses at most one line."""

    def __init__(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self._fh = path.open("a", encoding="utf-8")
        self._lock = threading.Lock()

    def append(self, row: dict[str, Any]) -> None:
        line = json.dumps(row, ensure_ascii=False) + "\n"
        with self._lock:
            self._fh.write(line)
            self._fh.flush()

    def close(self) -> None:
        self._fh.close()

    def __enter__(self) -> JsonlAppender:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()
