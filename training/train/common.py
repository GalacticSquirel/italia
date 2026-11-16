"""Shared GPU-side helpers: seeding, model loading, freezing, dataset reading.

Heavy imports (torch, transformers, unsloth) happen inside functions so the module imports
cleanly on machines without the `gpu` extra.
"""

from __future__ import annotations

import hashlib
import json
import logging
import random
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from datagen.jsonutil import read_jsonl
from train.config import BaseModelConfig
from train.tokenize import merge_system_message

log = logging.getLogger("train")


def seed_everything(seed: int, deterministic: bool) -> None:
    import transformers

    random.seed(seed)
    if deterministic:
        transformers.enable_full_determinism(seed)
    else:
        transformers.set_seed(seed)


def stable_subset(rows: list[dict[str, Any]], n: int | None, seed: int) -> list[dict[str, Any]]:
    """The first `n` rows in a seed-stable hash order (same subset on every machine)."""
    if n is None or n >= len(rows):
        return rows

    def key(row: dict[str, Any]) -> str:
        return hashlib.sha256(f"{seed}:{row.get('id', json.dumps(row))}".encode()).hexdigest()

    return sorted(rows, key=key)[:n]


def load_rows(path: Path) -> list[dict[str, Any]]:
    rows = list(read_jsonl(path))
    if not rows:
        raise ValueError(f"{path} is empty or missing")
    return rows


def prepare_messages(
    messages: Sequence[Mapping[str, str]], base: BaseModelConfig
) -> list[dict[str, str]]:
    if base.system_role == "merge":
        return merge_system_message(messages)
    return [dict(m) for m in messages]


def freeze_by_pattern(model: Any, patterns: Sequence[str]) -> int:
    """Freeze parameters whose names contain any pattern. Returns how many were frozen."""
    frozen = 0
    for name, param in model.named_parameters():
        if any(p in name for p in patterns):
            param.requires_grad_(False)
            frozen += param.numel()
    if patterns:
        log.info("froze %.1fM parameters matching %s", frozen / 1e6, list(patterns))
    return frozen


def load_tokenizer(base: BaseModelConfig, path: str | None = None) -> Any:
    from transformers import AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(path or base.id, revision=base.revision)
    if tokenizer.pad_token_id is None:
        tokenizer.pad_token = tokenizer.eos_token
    return tokenizer


def load_full_model(base: BaseModelConfig, path: str | None = None) -> Any:
    import torch
    from transformers import AutoModelForCausalLM, AutoModelForImageTextToText

    cls = (
        AutoModelForImageTextToText if base.loader == "image-text-to-text" else AutoModelForCausalLM
    )
    model = cls.from_pretrained(
        path or base.id,
        revision=base.revision if path is None else None,
        dtype=torch.bfloat16,
        attn_implementation="sdpa",
    )
    freeze_by_pattern(model, base.freeze_patterns)
    return model
