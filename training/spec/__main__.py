"""`python -m spec export-schema | render --scenario ID --level A2 | check`."""

from __future__ import annotations

import argparse
import sys

from spec.bundle import REPO_DIR, stale_outputs, write_outputs
from spec.levels import Level
from spec.models import LearnerProfile, TutorContext
from spec.render import render_system_prompt
from spec.scenarios import load_library


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m spec")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("export-schema", help="write every file generated from the spec")
    sub.add_parser("check", help="validate the scenario library and generated files")
    render = sub.add_parser("render", help="print the system prompt for a scenario")
    render.add_argument("--scenario", required=True)
    render.add_argument("--level", required=True, choices=[lv.value for lv in Level])
    args = parser.parse_args(argv)

    if args.cmd == "export-schema":
        for path in write_outputs():
            print(f"wrote {path.relative_to(REPO_DIR)}")
        return 0
    if args.cmd == "check":
        library = load_library()
        stale = [str(path.relative_to(REPO_DIR)) for path in stale_outputs()]
        print(f"{len(library)} scenarios OK")
        if stale:
            print(f"stale generated files (run export-schema): {stale}", file=sys.stderr)
            return 1
        return 0
    scenario = load_library()[args.scenario]
    context = TutorContext(learner=LearnerProfile(level=Level(args.level)), scenario=scenario)
    print(render_system_prompt(context))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
