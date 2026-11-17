"""What an MLX training output is made of, so it can be rebuilt without storing merged weights.

Every MLX run writes `final/` (and each checkpoint) with `weights.safetensors` and a small
`italia-train.json` that names its parent: the Hugging Face base for SFT, the SFT output for DPO.
Loading a DPO model therefore means: load the base, apply the SFT delta (fusing LoRA), then apply
the DPO delta. Only adapters (or, for full fine-tunes, the trained weights) are ever written.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

from train.config import BaseModelConfig, LoraConfig

LINEAGE_FILE = "italia-train.json"
DeltaKind = Literal["lora", "dora", "full"]


@dataclass(frozen=True)
class Delta:
    path: Path
    stage: Literal["sft", "dpo"]
    kind: DeltaKind
    lora: LoraConfig | None = None
    freeze_patterns: list[str] = field(default_factory=list)

    @property
    def weights(self) -> Path:
        return self.path / "weights.safetensors"


@dataclass(frozen=True)
class Lineage:
    base: BaseModelConfig
    deltas: list[Delta]  # root first


def delta_kind(method: str, lora: LoraConfig | None) -> DeltaKind:
    if method == "full":
        return "full"
    return "dora" if lora is not None and lora.dora else "lora"


def write_lineage(
    out: Path,
    *,
    stage: Literal["sft", "dpo"],
    base: BaseModelConfig,
    method: str,
    lora: LoraConfig | None,
    parent: Path | None,
    config: dict[str, Any],
) -> Path:
    """Describe the delta stored in `out` (call after its weights are written)."""
    record = {
        "format": 1,
        "backend": "mlx",
        "stage": stage,
        "kind": delta_kind(method, lora),
        "baseModel": base.model_dump(mode="json", by_alias=True),
        "lora": lora.model_dump(mode="json", by_alias=True) if lora else None,
        "parent": str(parent.resolve()) if parent is not None else None,
        "config": config,
    }
    path = out / LINEAGE_FILE
    path.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    return path


def is_mlx_output(path: Path) -> bool:
    return (path / LINEAGE_FILE).exists()


def resolve_lineage(path: Path, *, max_depth: int = 8) -> Lineage:
    """Walk parents back to the base model. Fails on cycles, missing files or mixed bases."""
    deltas: list[Delta] = []
    seen: set[Path] = set()
    current: Path | None = path
    base: BaseModelConfig | None = None
    while current is not None:
        resolved = current.resolve()
        if resolved in seen or len(deltas) >= max_depth:
            raise ValueError(f"lineage of {path} loops or is deeper than {max_depth}")
        seen.add(resolved)
        record_path = resolved / LINEAGE_FILE
        if not record_path.exists():
            raise FileNotFoundError(f"{resolved} is not an MLX training output ({LINEAGE_FILE})")
        record = json.loads(record_path.read_text(encoding="utf-8"))
        this_base = BaseModelConfig.model_validate(record["baseModel"])
        if base is not None and (this_base.id, this_base.revision) != (base.id, base.revision):
            raise ValueError(f"{resolved} was trained on {this_base.id}, its child on {base.id}")
        base = this_base
        lora = LoraConfig.model_validate(record["lora"]) if record.get("lora") else None
        delta = Delta(
            path=resolved,
            stage=record["stage"],
            kind=record["kind"],
            lora=lora,
            freeze_patterns=this_base.freeze_patterns,
        )
        if not delta.weights.exists():
            raise FileNotFoundError(f"{delta.weights} is missing")
        deltas.append(delta)
        parent = record.get("parent")
        current = Path(parent) if parent else None
    assert base is not None
    return Lineage(base=base, deltas=list(reversed(deltas)))
