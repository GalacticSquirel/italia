"""Merge a LoRA adapter into its bf16 base (full fine-tunes are already merged)."""

from __future__ import annotations

import json
from pathlib import Path


def is_adapter(model_dir: Path) -> bool:
    return (model_dir / "adapter_config.json").exists()


def adapter_base(model_dir: Path) -> str:
    config = json.loads((model_dir / "adapter_config.json").read_text(encoding="utf-8"))
    return str(config["base_model_name_or_path"])


def merge(model_dir: Path, out_dir: Path, *, loader: str = "causal-lm") -> Path:
    """Write merged bf16 weights and tokenizer to `out_dir` (returns `model_dir` if no adapter)."""
    if not is_adapter(model_dir):
        return model_dir
    import torch
    from peft import PeftModel
    from transformers import AutoModelForCausalLM, AutoModelForImageTextToText, AutoTokenizer

    image = loader == "image-text-to-text"
    cls = AutoModelForImageTextToText if image else AutoModelForCausalLM
    base = cls.from_pretrained(adapter_base(model_dir), dtype=torch.bfloat16)
    merged = PeftModel.from_pretrained(base, str(model_dir)).merge_and_unload()
    out_dir.mkdir(parents=True, exist_ok=True)
    merged.save_pretrained(str(out_dir), safe_serialization=True)
    AutoTokenizer.from_pretrained(str(model_dir)).save_pretrained(str(out_dir))
    return out_dir
