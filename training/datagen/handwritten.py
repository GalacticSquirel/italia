"""Hand-written dialogues: compile a compact YAML format into DialogueRecords and filter them.

Hand-written dialogues supplement the teacher's output where it is thin (for example the
tightest level bands). They go through the same filters as generated dialogues, so they meet the
same contract. Sources live in `data/handwritten/src/<set>/*.yaml`; the compiled records go to
`data/handwritten/<set>.jsonl` and `build-sft --extra` adds them to the SFT data.

One YAML file holds a list of dialogues:

    - scenario: bar-colazione        # a train-split scenario that lists this level
      level: A1
      persona: en-f-student           # an id from datagen.learner.PERSONAS
      history: [noun-gender]          # optional recurring-error tags (counts filled in)
      turns:
        - tutor: Buongiorno! Cosa prende?
        - learner: Buongiorno. Vorrei un cappuccino e una cornetto.
          errors: [noun-gender]       # the errors in this learner turn (omit when none)
        - tutor: Una cornetto? Cornetto è maschile...
          goals: [greet]              # goals newly completed by this turn (accumulated)
          prompt: {text: una cornetto, tags: [noun-gender]}
        - learner: Un cornetto, scusi.
        - tutor: Esatto! Ecco il cappuccino e il cornetto.
          goals: [order-drink, order-food]
          recast: {text: ..., fix: ..., tags: [...]}   # instead of prompt, when recasting
          new: [{lemma: bancone, gloss: counter}]
          done: false                 # default: true on the last tutor turn if all goals done

The learner plan (`LearnerTurnPlan`) is derived from the learner turns' `errors` and the feedback
policy (`spec.policy`), so the policy filter checks the tutor's moves against it.

    uv run python -m datagen.handwritten build a1      # compile + filter, write a1.jsonl
    uv run python -m datagen.handwritten build --all   # every set
    uv run python -m datagen.handwritten check a1      # compile + filter, print failures only
"""

from __future__ import annotations

import argparse
import hashlib
import sys
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from datagen.config import FilterConfig
from datagen.dedupe import find_duplicates
from datagen.filters import filter_dialogue
from datagen.jsonutil import read_jsonl, write_jsonl
from datagen.languagetool import GrammarChecker, LanguageToolClient, NullChecker
from datagen.learner import PERSONAS_BY_ID
from datagen.lemmas import (
    DEFAULT_LEMMA_FILE,
    TRAINING_DIR,
    BandChecker,
    LemmaList,
    SimplemmaLemmatizer,
)
from datagen.records import DialogueRecord, FilterResult, LearnerTurnPlan
from spec.levels import Level
from spec.models import (
    SPEC_VERSION,
    Annotations,
    ErrorHistoryItem,
    LearnerProfile,
    NewWord,
    Prompt,
    Recast,
    Scenario,
    ScenarioProgress,
    Turn,
    TutorContext,
    TutorOutput,
)
from spec.policy import expected_move, pick_target_error
from spec.scenarios import load_library
from spec.taxonomy import error_tags

HANDWRITTEN_DIR = TRAINING_DIR / "data" / "handwritten"
SOURCE_DIR = HANDWRITTEN_DIR / "src"
TEACHER_LABEL = "handwritten"


class AuthoringError(ValueError):
    """A source dialogue that cannot be compiled (wrong ids, roles, shapes)."""


@dataclass(frozen=True)
class Source:
    set_name: str
    path: Path
    index: int
    raw: dict[str, Any]

    @property
    def where(self) -> str:
        return f"{self.path.name}[{self.index}]"


def load_sources(set_name: str, source_dir: Path = SOURCE_DIR) -> list[Source]:
    folder = source_dir / set_name
    files = sorted(folder.glob("*.yaml"))
    if not files:
        raise AuthoringError(f"no YAML files in {folder}")
    out: list[Source] = []
    for path in files:
        items = yaml.safe_load(path.read_text(encoding="utf-8")) or []
        if not isinstance(items, list):
            raise AuthoringError(f"{path.name}: expected a list of dialogues")
        out.extend(Source(set_name, path, i, item) for i, item in enumerate(items))
    return out


def _tags(value: Any, where: str) -> list[str]:
    tags = list(value or [])
    unknown = [t for t in tags if t not in error_tags()]
    if unknown:
        raise AuthoringError(f"{where}: unknown error tags {unknown}")
    return tags


def _output(item: dict[str, Any], goals_so_far: list[str], where: str) -> TutorOutput:
    prompt = recast = None
    if item.get("prompt"):
        p = item["prompt"]
        prompt = Prompt(learner_text=p["text"], error_tags=_tags(p.get("tags"), where))
    if item.get("recast"):
        r = item["recast"]
        recast = Recast(
            learner_text=r["text"],
            corrected_text=r["fix"],
            error_tags=_tags(r.get("tags"), where),
        )
    words = [NewWord(lemma=w["lemma"], gloss_en=w["gloss"]) for w in item.get("new") or []]
    return TutorOutput(
        reply=str(item["tutor"]).strip(),
        annotations=Annotations(
            prompt=prompt,
            recast=recast,
            new_words=words,
            scenario_progress=ScenarioProgress(
                goals_completed=list(goals_so_far), done=bool(item.get("done", False))
            ),
        ),
    )


def compile_source(  # noqa: PLR0912 (one pass over the turns, checking as it goes)
    source: Source, library: dict[str, Scenario]
) -> DialogueRecord:
    """One source dialogue as a DialogueRecord (no filter result yet)."""
    raw, where = source.raw, source.where
    scenario = library.get(str(raw.get("scenario")))
    if scenario is None:
        raise AuthoringError(f"{where}: unknown scenario {raw.get('scenario')!r}")
    if scenario.split != "train":
        raise AuthoringError(f"{where}: {scenario.id} is an evaluation scenario")
    level = Level(raw["level"])
    if level not in scenario.levels:
        raise AuthoringError(f"{where}: {scenario.id} does not list level {level.value}")
    persona = PERSONAS_BY_ID.get(str(raw.get("persona")))
    if persona is None:
        raise AuthoringError(f"{where}: unknown persona {raw.get('persona')!r}")
    taxonomy = error_tags()
    history_tags = _tags(raw.get("history"), where)
    history = [
        ErrorHistoryItem(
            tag=t,
            count=2 + int(hashlib.sha256(f"{where}{t}".encode()).hexdigest(), 16) % 6,
            last_example=taxonomy[t].example_wrong,
        )
        for t in history_tags
    ]
    context = TutorContext(
        learner=LearnerProfile(level=level, error_history=history), scenario=scenario
    )
    items = raw.get("turns") or []
    goal_ids = [g.id for g in scenario.goals]
    goals_so_far: list[str] = []
    turns: list[Turn] = []
    plan: list[LearnerTurnPlan] = []
    learner_errors: list[str] = []
    prompted: list[str] = []
    for n, item in enumerate(items):
        at = f"{where}.turns[{n}]"
        expect_tutor = n % 2 == 0
        if expect_tutor != ("tutor" in item):
            raise AuthoringError(f"{at}: turns must alternate, starting with the tutor")
        if "tutor" in item:
            for g in item.get("goals") or []:
                if g not in goal_ids:
                    raise AuthoringError(f"{at}: unknown goal {g!r} (have {goal_ids})")
                if g not in goals_so_far:
                    goals_so_far.append(g)
            last = n == len(items) - 1
            spec = dict(item)
            if last and "done" not in spec:
                spec["done"] = set(goals_so_far) == set(goal_ids)
            output = _output(spec, goals_so_far, at)
            turns.append(Turn.tutor(output))
            if n > 0:
                plan.append(_plan_step(learner_errors, prompted, output, scenario, history_tags))
            prompted = (
                list(output.annotations.prompt.error_tags) if output.annotations.prompt else []
            )
        else:
            learner_errors = _tags(item.get("errors"), at)
            turns.append(Turn.learner(str(item["learner"]).strip()))
    if not turns or turns[-1].role != "tutor":
        raise AuthoringError(f"{where}: the dialogue must end with a tutor turn")
    digest = hashlib.sha256(f"{source.set_name}|{where}".encode()).hexdigest()[:8]
    return DialogueRecord(
        id=f"hw-{source.set_name}-{digest}",
        spec_version=SPEC_VERSION,
        split="train",
        scenario_id=scenario.id,
        level=level,
        persona=persona,
        context=context,
        plan=plan,
        turns=turns,
        teacher=TEACHER_LABEL,
        parse_notes=[f"source {source.set_name}/{where}"],
    )


def _plan_step(
    errors: list[str],
    prompted: list[str],
    output: TutorOutput,
    scenario: Scenario,
    history: Sequence[str],
) -> LearnerTurnPlan:
    """The plan step for one learner turn, as the learner simulator would have written it."""
    if prompted:
        if not errors:
            return LearnerTurnPlan(kind="repair-success", expected_move="none")
        return LearnerTurnPlan(
            kind="repair-fail",
            error_tags=errors,
            target_tag=prompted[0] if prompted[0] in errors else errors[0],
            expected_move=expected_move(errors, prompted),
        )
    if not errors:
        return LearnerTurnPlan(kind="fresh", expected_move="none")
    # The tutor's chosen tag wins when it is one of the turn's errors; else the policy's pick.
    chosen = [t for t in output.annotations.error_tags if t in errors]
    target = chosen[0] if chosen else pick_target_error(errors, scenario, history)
    return LearnerTurnPlan(
        kind="fresh",
        error_tags=errors,
        target_tag=target,
        expected_move=expected_move([target] if target else []),
    )


def default_filter_config() -> FilterConfig:
    """The filter thresholds of the training configs (train.yaml)."""
    return FilterConfig(
        max_reply_chars=400,
        band_slack=0.0,
        sentence_slack_words=3,
        max_lt_errors_per_100_words=1.0,
        min_policy_agreement=0.8,
    )


def compile_set(
    set_name: str,
    *,
    grammar: GrammarChecker,
    source_dir: Path = SOURCE_DIR,
    config: FilterConfig | None = None,
) -> tuple[list[DialogueRecord], list[str]]:
    """Compile and filter one set. Returns the records (with filter results) and errors."""
    library = load_library()
    checker = BandChecker(LemmaList.load(DEFAULT_LEMMA_FILE), SimplemmaLemmatizer())
    config = config or default_filter_config()
    records: list[DialogueRecord] = []
    problems: list[str] = []
    for source in load_sources(set_name, source_dir):
        try:
            record = compile_source(source, library)
        except (AuthoringError, ValueError, KeyError, TypeError) as err:
            problems.append(f"{source.where}: {err}")
            continue
        result = filter_dialogue(record, band_checker=checker, grammar=grammar, config=config)
        records.append(record.model_copy(update={"filter": result}))
    texts = {r.id: "\n".join(t.text for t in r.turns) for r in records}
    duplicates = find_duplicates(texts, threshold=0.8)
    ids = [r.id for r in records]
    for dup in {i for i in ids if ids.count(i) > 1}:
        problems.append(f"duplicate id {dup}")
    out: list[DialogueRecord] = []
    for record in records:
        checked = record.filter
        assert checked is not None
        if record.id in duplicates:
            checked = FilterResult(
                passed=False, reasons=[*checked.reasons, "near-duplicate"], metrics=checked.metrics
            )
        out.append(record.model_copy(update={"filter": checked}))
    return out, problems


def load_handwritten(paths: Iterable[Path]) -> list[DialogueRecord]:
    """Compiled hand-written records that passed their filters (for build-sft --extra)."""
    out: list[DialogueRecord] = []
    for path in paths:
        for row in read_jsonl(path):
            record = DialogueRecord.model_validate(row)
            if record.filter is not None and record.filter.passed and record.split == "train":
                out.append(record)
    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m datagen.handwritten")
    parser.add_argument("command", choices=["build", "check"])
    parser.add_argument("sets", nargs="*", help="set names (folders under data/handwritten/src)")
    parser.add_argument("--all", action="store_true", help="every set under the source folder")
    parser.add_argument("--languagetool-url", default="http://localhost:8010/v2")
    parser.add_argument("--no-languagetool", action="store_true", help="skip grammar checks")
    parser.add_argument("--source-dir", default=str(SOURCE_DIR))
    parser.add_argument("--out-dir", default=str(HANDWRITTEN_DIR))
    args = parser.parse_args(argv)
    source_dir = Path(args.source_dir)
    sets = sorted(p.name for p in source_dir.iterdir() if p.is_dir()) if args.all else args.sets
    if not sets:
        parser.error("name at least one set, or pass --all")
    grammar: GrammarChecker = (
        NullChecker() if args.no_languagetool else LanguageToolClient(args.languagetool_url)
    )
    status = 0
    for set_name in sets:
        records, problems = compile_set(set_name, grammar=grammar, source_dir=source_dir)
        for problem in problems:
            print(f"[{set_name}] ERROR {problem}")
        failed = [r for r in records if r.filter is not None and not r.filter.passed]
        for record in failed:
            assert record.filter is not None
            print(f"[{set_name}] FAIL {record.parse_notes[0]} ({record.scenario_id}):")
            for reason in record.filter.reasons:
                print(f"    - {reason}")
        passed = len(records) - len(failed)
        print(f"[{set_name}] {passed}/{len(records) + len(problems)} pass")
        if problems or failed:
            status = 1
        if args.command == "build":
            out = Path(args.out_dir) / f"{set_name}.jsonl"
            kept = (r.to_wire() for r in records if r.filter is not None and r.filter.passed)
            n = write_jsonl(out, kept)
            print(f"[{set_name}] wrote {n} passing records -> {out}")
    return status


if __name__ == "__main__":
    sys.exit(main())
