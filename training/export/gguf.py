"""GGUF conversion and quantisation with llama.cpp (commands are built here, run by the CLI).

Order of operations (from the research): merge LoRA into bf16 weights first, convert to a bf16
GGUF, optionally compute an importance matrix on in-domain Italian tutoring text, then quantise
to Q4_0 (the format llama.rn's Adreno OpenCL path accelerates). Never ship a bf16-trained LoRA
applied at runtime over a Q4 base.
"""

from __future__ import annotations

import subprocess
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

from datagen.lemmas import TRAINING_DIR

QUANT_TYPES = ("Q4_0", "Q4_K_M", "IQ4_XS", "Q6_K", "Q8_0")


@dataclass(frozen=True)
class LlamaCpp:
    root: Path

    @classmethod
    def default(cls) -> LlamaCpp:
        return cls(TRAINING_DIR / "work" / "llama.cpp")

    @property
    def python(self) -> Path:
        return self.root / ".venv" / "bin" / "python"

    def tool(self, name: str) -> Path:
        return self.root / "build" / "bin" / name

    def check(self) -> list[str]:
        """Missing pieces (empty when the toolchain is ready)."""
        needed = [
            self.root / "convert_hf_to_gguf.py",
            self.python,
            self.tool("llama-quantize"),
            self.tool("llama-imatrix"),
        ]
        return [str(p) for p in needed if not p.exists()]


def convert_command(llama: LlamaCpp, model_dir: Path, out_file: Path) -> list[str]:
    return [
        str(llama.python),
        str(llama.root / "convert_hf_to_gguf.py"),
        str(model_dir),
        "--outfile",
        str(out_file),
        "--outtype",
        "bf16",
    ]


def imatrix_command(
    llama: LlamaCpp,
    model_file: Path,
    calibration: Path,
    out_file: Path,
    *,
    context: int = 2048,
    gpu_layers: int = 99,
    chunks: int | None = None,
) -> list[str]:
    cmd = [
        str(llama.tool("llama-imatrix")),
        "-m",
        str(model_file),
        "-f",
        str(calibration),
        "-o",
        str(out_file),
        "-c",
        str(context),
        "-ngl",
        str(gpu_layers),
    ]
    if chunks is not None:
        cmd += ["--chunks", str(chunks)]
    return cmd


def quantize_command(
    llama: LlamaCpp,
    source: Path,
    out_file: Path,
    quant: str,
    *,
    imatrix: Path | None = None,
) -> list[str]:
    if quant not in QUANT_TYPES:
        raise ValueError(f"unsupported quant type {quant}; use one of {QUANT_TYPES}")
    cmd = [str(llama.tool("llama-quantize"))]
    if imatrix is not None:
        cmd += ["--imatrix", str(imatrix)]
    return [*cmd, str(source), str(out_file), quant]


def gguf_name(model_id: str, quant: str, imatrix: bool) -> str:
    suffix = "-imat" if imatrix else ""
    return f"{model_id}-{quant.lower()}{suffix}.gguf"


@dataclass(frozen=True)
class ExportPlan:
    commands: list[list[str]]
    outputs: list[Path]


def plan_export(
    llama: LlamaCpp,
    model_dir: Path,
    out_dir: Path,
    model_id: str,
    *,
    quants: Sequence[str] = ("Q4_0",),
    calibration: Path | None = None,
) -> ExportPlan:
    """All commands, in order, to go from merged HF weights to quantised GGUFs."""
    bf16 = out_dir / f"{model_id}-bf16.gguf"
    commands = [convert_command(llama, model_dir, bf16)]
    imatrix = None
    if calibration is not None:
        imatrix = out_dir / f"{model_id}.imatrix"
        commands.append(imatrix_command(llama, bf16, calibration, imatrix))
    outputs = []
    for quant in quants:
        target = out_dir / gguf_name(model_id, quant, imatrix is not None)
        commands.append(quantize_command(llama, bf16, target, quant, imatrix=imatrix))
        outputs.append(target)
    return ExportPlan(commands=commands, outputs=outputs)


def run_commands(commands: Sequence[Sequence[str]], *, dry_run: bool = False) -> None:
    for cmd in commands:
        print("+ " + " ".join(cmd), flush=True)
        if not dry_run:
            subprocess.run(list(cmd), check=True)
