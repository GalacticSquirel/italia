"""`python -m spec export-schema | render --scenario ID --level A2 | check`."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from spec.bundle import GENERATED_DIR, generated_files
from spec.levels import Level
from spec.models import (
    SPEC_VERSION,
    LearnerProfile,
    Scenario,
    TutorContext,
    TutorOutput,
    strip_titles,
)
from spec.render import render_system_prompt
from spec.scenarios import load_library
from spec.taxonomy import SPEC_DIR

SCHEMA_DIR = SPEC_DIR / "schema"


def schemas() -> dict[str, dict[str, object]]:
    """JSON Schemas generated from the models, by file name."""
    major = SPEC_VERSION.split(".")[0]
    out: dict[str, dict[str, object]] = {}
    for name, model in (
        ("tutor_output", TutorOutput),
        ("tutor_context", TutorContext),
        ("scenario", Scenario),
    ):
        schema = strip_titles(model.model_json_schema(by_alias=True, mode="serialization"))
        schema = {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "$id": f"https://italia.app/schemas/tutor/{name}.v{major}.schema.json",
            "x-spec-version": SPEC_VERSION,
            **schema,
        }
        out[f"{name}.v{major}.schema.json"] = schema
    return out


def dump(schema: dict[str, object]) -> str:
    return json.dumps(schema, ensure_ascii=False, indent=2) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m spec")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("export-schema", help="write spec/schema/*.json and spec/generated/*.json")
    sub.add_parser("check", help="validate the scenario library and schema files")
    render = sub.add_parser("render", help="print the system prompt for a scenario")
    render.add_argument("--scenario", required=True)
    render.add_argument("--level", required=True, choices=[lv.value for lv in Level])
    args = parser.parse_args(argv)

    if args.cmd == "export-schema":
        SCHEMA_DIR.mkdir(exist_ok=True)
        for name, schema in schemas().items():
            (SCHEMA_DIR / name).write_text(dump(schema), encoding="utf-8")
            print(f"wrote {SCHEMA_DIR / name}")
        GENERATED_DIR.mkdir(exist_ok=True)
        for name, data in generated_files().items():
            (GENERATED_DIR / name).write_text(dump(data), encoding="utf-8")
            print(f"wrote {GENERATED_DIR / name}")
        return 0
    if args.cmd == "check":
        library = load_library()
        stale = [n for n, s in schemas().items() if not _same(SCHEMA_DIR / n, dump(s))]
        stale += [n for n, d in generated_files().items() if not _same(GENERATED_DIR / n, dump(d))]
        print(f"{len(library)} scenarios OK")
        if stale:
            print(f"stale schema files (run export-schema): {stale}", file=sys.stderr)
            return 1
        return 0
    scenario = load_library()[args.scenario]
    context = TutorContext(learner=LearnerProfile(level=Level(args.level)), scenario=scenario)
    print(render_system_prompt(context))
    return 0


def _same(path: Path, text: str) -> bool:
    return path.exists() and path.read_text(encoding="utf-8") == text


if __name__ == "__main__":
    raise SystemExit(main())
