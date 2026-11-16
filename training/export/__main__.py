"""Export CLI. Run from `training/`: `uv run python -m export <command> ...`.

merge        merge a LoRA adapter into bf16 weights (no-op for full fine-tunes)
calibration  write imatrix calibration text from the SFT data
gguf         convert to GGUF and quantise (Q4_0 by default; --imatrix to calibrate)
manifest     sha256 + size -> upsert an entry in models/manifest.json
smoke        run the GGUF on CPU with llama-cpp-python for a few tutor prompts
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from datagen.jsonutil import read_jsonl
from export.calibration import calibration_text
from export.gguf import QUANT_TYPES, LlamaCpp, plan_export, run_commands
from export.manifest import MANIFEST, manifest_entry, upsert_entry
from export.merge import merge
from export.smoke import llama_cpp_completer, run_smoke


def cmd_merge(args: argparse.Namespace) -> int:
    out = merge(Path(args.model), Path(args.out), loader=args.loader)
    print(f"merged weights: {out}")
    return 0


def cmd_calibration(args: argparse.Namespace) -> int:
    text = calibration_text(read_jsonl(Path(args.sft)), max_chars=args.max_chars)
    Path(args.out).write_text(text, encoding="utf-8")
    print(f"{len(text):,} characters -> {args.out}")
    return 0


def cmd_gguf(args: argparse.Namespace) -> int:
    llama = LlamaCpp(Path(args.llama_cpp)) if args.llama_cpp else LlamaCpp.default()
    missing = llama.check()
    if missing and not args.dry_run:
        print(
            "llama.cpp is not built; run export/build_llama_cpp.sh. Missing:",
            *missing,
            sep="\n  ",
            file=sys.stderr,
        )
        return 1
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    plan = plan_export(
        llama,
        Path(args.model),
        out_dir,
        args.id,
        quants=args.quant or ["Q4_0"],
        calibration=Path(args.imatrix) if args.imatrix else None,
    )
    run_commands(plan.commands, dry_run=args.dry_run)
    for output in plan.outputs:
        print(f"output: {output}")
    return 0


def cmd_manifest(args: argparse.Namespace) -> int:
    entry = manifest_entry(Path(args.gguf), model_id=args.id, url=args.url, licence=args.licence)
    print(json.dumps(entry, indent=2))
    if args.write:
        upsert_entry(entry, Path(args.manifest))
        print(f"updated {args.manifest}")
    return 0


def cmd_smoke(args: argparse.Namespace) -> int:
    results = run_smoke(llama_cpp_completer(Path(args.gguf), threads=args.threads))
    for r in results:
        status = "ok" if r.valid and r.behaved else ("WARN" if r.valid else "FAIL")
        print(f"[{status}] {r.case}: {r.detail}\n    {r.text[:300]}")
    return 0 if all(r.valid for r in results) else 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m export",
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("merge")
    p.add_argument("--model", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--loader", choices=["causal-lm", "image-text-to-text"], default="causal-lm")
    p.set_defaults(fn=cmd_merge)
    p = sub.add_parser("calibration")
    p.add_argument("--sft", required=True, help="sft.train.jsonl")
    p.add_argument("--out", required=True)
    p.add_argument("--max-chars", type=int, default=2_000_000)
    p.set_defaults(fn=cmd_calibration)
    p = sub.add_parser("gguf")
    p.add_argument("--model", required=True, help="merged HF model directory")
    p.add_argument("--id", required=True, help="model id, e.g. italia-tutor-e4b")
    p.add_argument("--out-dir", default="out/gguf")
    p.add_argument("--quant", action="append", choices=QUANT_TYPES)
    p.add_argument("--imatrix", help="calibration text file; enables importance-matrix quants")
    p.add_argument("--llama-cpp", help="llama.cpp checkout (default work/llama.cpp)")
    p.add_argument("--dry-run", action="store_true")
    p.set_defaults(fn=cmd_gguf)
    p = sub.add_parser("manifest")
    p.add_argument("--gguf", required=True)
    p.add_argument("--id", required=True)
    p.add_argument("--url", required=True, help="HTTPS URL the app downloads the file from")
    p.add_argument("--licence", default="Apache-2.0")
    p.add_argument("--manifest", default=str(MANIFEST))
    p.add_argument("--write", action="store_true", help="upsert into the manifest")
    p.set_defaults(fn=cmd_manifest)
    p = sub.add_parser("smoke")
    p.add_argument("--gguf", required=True)
    p.add_argument("--threads", type=int)
    p.set_defaults(fn=cmd_smoke)
    args = parser.parse_args(argv)
    result: int = args.fn(args)
    return result


if __name__ == "__main__":
    raise SystemExit(main())
