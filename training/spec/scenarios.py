"""Load and validate the scenario library (`scenarios/*.yaml`)."""

from __future__ import annotations

from functools import cache
from pathlib import Path

import yaml

from spec.levels import Level
from spec.models import Scenario
from spec.taxonomy import SPEC_DIR, grammar_points

SCENARIO_DIR = SPEC_DIR.parent / "scenarios"


class ScenarioError(ValueError):
    pass


def load_scenario(path: Path) -> Scenario:
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ScenarioError(f"{path.name}: expected a mapping")
    scenario = Scenario.model_validate(raw)
    if scenario.id != path.stem:
        raise ScenarioError(f"{path.name}: id {scenario.id!r} must match the file name")
    points = grammar_points()
    unknown = [s for s in scenario.grammar_focus if s not in points]
    if unknown:
        raise ScenarioError(f"{path.name}: unknown grammar points {unknown}")
    too_hard = [s for s in scenario.grammar_focus if not points[s].cefr.at_most(_top(scenario))]
    if too_hard:
        raise ScenarioError(f"{path.name}: grammar focus above the scenario's levels: {too_hard}")
    return scenario


def _top(scenario: Scenario) -> Level:
    return max(scenario.levels, key=lambda lv: lv.rank)


@cache
def load_library(directory: Path = SCENARIO_DIR) -> dict[str, Scenario]:
    """All scenarios by id, sorted by id."""
    scenarios = [load_scenario(p) for p in sorted(directory.glob("*.yaml"))]
    return {s.id: s for s in scenarios}


def scenarios_for(level: Level, split: str | None = None) -> list[Scenario]:
    return [
        s
        for s in load_library().values()
        if level in s.levels and (split is None or s.split == split)
    ]
