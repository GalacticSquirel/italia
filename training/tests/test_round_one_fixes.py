"""Fixes from the first local generation round: repair turns, tolerant parsing, band false
positives, prompts that reveal the correction, and `refilter`."""

from __future__ import annotations

import copy
import json
from collections.abc import Sequence
from pathlib import Path
from typing import Any

import pytest

from datagen.config import FilterConfig
from datagen.filters import check_tutor_turn, prompt_reveal_reasons, reveals_correction
from datagen.jsonutil import read_jsonl, write_jsonl
from datagen.judge import parse_dialogue_judgement
from datagen.languagetool import NullChecker
from datagen.learner import build_jobs
from datagen.lemmas import BandChecker, SimplemmaLemmatizer, default_lemma_list, tokens
from datagen.records import DialogueRecord, Job, LearnerTurnPlan
from datagen.runner import RunPaths, pending_jobs, run_generate, run_refilter, select_scenarios
from datagen.synthesis import (
    SynthesisError,
    dialogue_json,
    make_brief,
    parse_dialogue,
    prepare,
    repair_message,
    sanitize_output,
    synthesize,
)
from datagen.teacher import ScriptedClient
from spec.levels import Level, band_for
from spec.models import Scenario, Turn, TutorOutput
from spec.render import ChatMessage
from spec.scenarios import load_library
from tests.helpers import make_config, make_record, output, plan_following_turns

FIXTURES = Path(__file__).parent / "fixtures"


def _rows(name: str) -> list[dict[str, object]]:
    return [json.loads(line) for line in (FIXTURES / name).read_text().splitlines()]


@pytest.fixture(scope="module")
def checker() -> BandChecker:
    return BandChecker(default_lemma_list(), SimplemmaLemmatizer())


# --- band false positives -------------------------------------------------------------------

BAND_ROWS = _rows("band_rejections.jsonl")


@pytest.mark.parametrize("row", BAND_ROWS, ids=[str(r["id"]) for r in BAND_ROWS])
def test_band_fixture_rows_pass(row: dict[str, object], checker: BandChecker) -> None:
    """Every row was rejected as out of band in round 1 (2/16 passed); all are false positives."""
    check = check_tutor_turn(
        TutorOutput.model_validate(row["output"]),
        level=Level(str(row["level"])),
        scenario=load_library()[str(row["scenario"])],
        previous_learner=str(row["learner"]),
        band_checker=checker,
        config=FilterConfig(),
    )
    assert check.reasons == []
    assert check.out_of_band_tokens == 0


def test_echo_is_only_skipped_when_the_learner_said_it(checker: BandChecker) -> None:
    band = band_for(Level.A1)
    assert [o.token for o in checker.check("Non sapo?", band).out_of_band] == ["sapo"]
    assert checker.check("Non sapo?", band, echoed=["Non sapo dove"]).out_of_band == []


@pytest.mark.parametrize(
    ("form", "lemma"),
    [
        ("correttamente", "corretto"),
        ("facilmente", "facile"),
        ("velocemente", "veloce"),
        ("tranquillamente", "tranquillo"),
        ("benissimo", "bene"),
        ("lunghissimo", "lungo"),
        ("grandissima", "grande"),
    ],
)
def test_adverbs_and_superlatives_reach_their_base(form: str, lemma: str) -> None:
    assert lemma in SimplemmaLemmatizer().lemmas(form)


def test_elision_is_marked_and_restored(checker: BandChecker) -> None:
    toks = tokens("qualcos'altro, vent'anni, qualcos' altro")
    assert [(t.text, t.elided) for t in toks] == [
        ("qualcos", True),
        ("altro", False),
        ("vent", True),
        ("anni", False),
        ("qualcos", True),
        ("altro", False),
    ]
    assert "qualcosa" in checker.candidates(toks[0])
    assert "venti" in checker.candidates(toks[2])


def test_rare_words_are_still_out_of_band(checker: BandChecker) -> None:
    report = checker.check("Il condominio ha un ascensore.", band_for(Level.A1))
    assert {o.token for o in report.out_of_band} == {"condominio", "ascensore"}


# --- tolerant parsing, sanitising and the repair turn ---------------------------------------

PARSE_ROWS = _rows("parse_drafts.jsonl")


@pytest.mark.parametrize("row", PARSE_ROWS, ids=[str(r["id"]) for r in PARSE_ROWS])
def test_parse_fixture(row: dict[str, object]) -> None:
    """Round-1 style first drafts: 3/21 parsed before, 15/21 now (the rest go to repair)."""
    plan = [LearnerTurnPlan.model_validate(p) for p in row["plan"]]  # type: ignore[attr-defined]
    goals = {g.id for g in load_library()[str(row["scenario"])].goals}
    if row["expect"] == "pass":
        parsed = parse_dialogue(str(row["text"]), plan, goals)
        assert len(parsed.plan) == len([t for t in parsed.turns if t.role == "learner"])
    else:
        with pytest.raises(SynthesisError) as err:
            parse_dialogue(str(row["text"]), plan, goals)
        assert "learner turns" in err.value.problems[0]


def test_tolerated_extra_exchange_is_planned_as_no_correction() -> None:
    row = next(r for r in PARSE_ROWS if r["id"] == "extra-exchange-0")
    plan = [LearnerTurnPlan.model_validate(p) for p in row["plan"]]  # type: ignore[attr-defined]
    parsed = parse_dialogue(str(row["text"]), plan)
    assert parsed.plan[:-1] == plan
    assert parsed.plan[-1].expected_move == "none" and not parsed.plan[-1].error_tags
    assert any("accepted 5 learner turns for 4" in n for n in parsed.notes)


def test_sanitize_drops_bad_items_and_keeps_the_turn() -> None:
    raw: dict[str, Any] = {
        "reply": "Bene!",
        "annotations": {
            "prompt": {"learnerText": "x", "errorTags": ["made-up"]},
            "recast": {
                "learnerText": "Sono andato",
                "correctedText": "sono andato.",
                "errorTags": ["auxiliary-choice"],
            },
            "newWords": [{"lemma": "a", "glossEn": "b"}, {"lemma": "c"}, "d"],
            "scenarioProgress": {"goalsCompleted": ["g1", "nope"], "done": False},
        },
    }
    cleaned, notes = sanitize_output(raw, {"g1"})
    ann = cleaned["annotations"]
    assert ann["prompt"] is None and ann["recast"] is None
    assert ann["newWords"] == [{"lemma": "a", "glossEn": "b"}]
    assert ann["scenarioProgress"]["goalsCompleted"] == ["g1"]
    assert len(notes) == 5
    TutorOutput.model_validate(cleaned)
    assert raw["annotations"]["prompt"] is not None  # the input is not mutated


def _job_and_payload() -> tuple[Job, Scenario, str, list[LearnerTurnPlan]]:
    config = make_config()
    scenarios = [s for s in load_library().values() if s.split == "train"]
    job = build_jobs(config, scenarios)[0]
    scenario = load_library()[job.scenario_id]
    _, _, plan = prepare(job, scenario, config)
    return job, scenario, dialogue_json(plan_following_turns(plan, scenario.opening)), plan


def test_repair_turn_recovers_a_bad_draft() -> None:
    job, scenario, good, plan = _job_and_payload()
    bad = json.loads(good)
    bad["turns"] = bad["turns"][:-4]  # two exchanges short: not tolerated
    teacher = ScriptedClient([json.dumps(bad), good])
    record = synthesize(job, scenario, make_config(), teacher)
    assert record.repaired and len(teacher.calls) == 2
    repair = teacher.calls[1]
    assert [m["role"] for m in repair] == ["user", "assistant", "user"]
    assert f"exactly {len(plan)} learner turns" in repair[2]["content"]
    assert record.usage.output_tokens > len(good) // 4  # both calls are counted


def test_repair_is_bounded_and_keeps_the_failed_text() -> None:
    job, scenario, _, _ = _job_and_payload()
    teacher = ScriptedClient(["not json at all"])
    with pytest.raises(SynthesisError) as err:
        synthesize(job, scenario, make_config(repairAttempts=1), teacher)
    assert len(teacher.calls) == 2
    assert err.value.text == "not json at all"
    no_repair = ScriptedClient(["not json at all"])
    with pytest.raises(SynthesisError):
        synthesize(job, scenario, make_config(repairAttempts=0), no_repair)
    assert len(no_repair.calls) == 1


def test_repair_message_lists_problems() -> None:
    message = repair_message(["turns[2].output.reply: Field required"], 4)
    assert "turns[2].output.reply" in message and "4 learner turns, 5 tutor turns" in message


# --- prompts that reveal the correction -----------------------------------------------------


def test_reveals_correction() -> None:
    assert reveals_correction("Come si dice la cucina piccola?", "cucina piccolo", "cucina piccola")
    assert not reveals_correction(
        "La cucina piccolo? Cucina è femminile...", "cucina piccolo", "cucina piccola"
    )
    assert reveals_correction("Si dice c'è un balcone?", "ci sono un balcone", "c'è un balcone")
    assert not reveals_correction(
        "Ci sono un balcone? Sicuro?", "ci sono un balcone", "c'è un balcone"
    )


def _cucina_record(prompt_reply: str) -> DialogueRecord:
    """A prompt on "cucina piccolo", then a successful repair and an acknowledgement."""
    base = make_record("casa-mia", Level.A1)
    tag = "adjective-agreement"
    plan = [
        LearnerTurnPlan(kind="fresh", error_tags=[tag], target_tag=tag, expected_move="prompt"),
        LearnerTurnPlan(kind="repair-success", error_tags=[], expected_move="none"),
    ]
    turns = [
        Turn.tutor(output("Com'è la tua casa?")),
        Turn.learner("La mia cucina piccolo."),
        Turn.tutor(output(prompt_reply, prompt=("cucina piccolo", [tag]))),
        Turn.learner("La mia cucina è piccola."),
        Turn.tutor(output("Esatto! Grazie, a presto!", done=True)),
    ]
    return base.model_copy(update={"plan": plan, "turns": turns})


def test_prompt_reveal_filter() -> None:
    assert prompt_reveal_reasons(_cucina_record("Come si dice la cucina piccola?")) == [
        "turn 2: prompt reveals the correction"
    ]
    assert prompt_reveal_reasons(_cucina_record("La cucina piccolo? Cucina è femminile...")) == []


def test_prompt_reveal_uses_a_later_recast() -> None:
    """When the learner fails the repair, the following recast tells what the prompt withheld."""
    tag = "auxiliary-choice"
    plan = [
        LearnerTurnPlan(kind="fresh", error_tags=[tag], target_tag=tag, expected_move="prompt"),
        LearnerTurnPlan(
            kind="repair-fail", error_tags=[tag], target_tag=tag, expected_move="recast"
        ),
    ]

    def record(prompt_reply: str) -> DialogueRecord:
        turns = [
            Turn.tutor(output("Cosa hai fatto ieri?")),
            Turn.learner("Ieri ho andato al bar."),
            Turn.tutor(output(prompt_reply, prompt=("ho andato", [tag]))),
            Turn.learner("Ieri ho andato al bar, sì."),
            Turn.tutor(output("Ah, sei andato al bar!", recast=("ho andato", "sei andato", [tag]))),
        ]
        return make_record().model_copy(update={"plan": plan, "turns": turns})

    assert prompt_reveal_reasons(record("Ho andato? Sei sicuro?")) == []
    assert prompt_reveal_reasons(record("Ho andato o sei andato?")) == [
        "turn 2: prompt reveals the correction"
    ]


def test_judge_rubric_has_prompt_withholds() -> None:
    old = (
        '{"scores": {"grammaticality": 5, "levelFit": 5, "feedback": 5, '
        '"annotationAccuracy": 5, "scenario": 5, "tone": 5}}'
    )
    assert parse_dialogue_judgement(old).scores.prompt_withholds is None
    assert parse_dialogue_judgement(old).overall == 5
    new = old.replace('"tone": 5', '"tone": 5, "promptWithholds": 1')
    result = parse_dialogue_judgement(new)
    assert result.scores.prompt_withholds == 1
    assert result.overall == pytest.approx(31 / 7)


# --- refilter -------------------------------------------------------------------------------


def test_refilter_reparses_failed_and_prunes_judged(tmp_path: Path, checker: BandChecker) -> None:
    config = make_config(tmp_path, targetDialogues=4, repairAttempts=0)
    library = load_library()
    scenarios = select_scenarios(config, library)
    jobs = build_jobs(config, scenarios)

    payloads: dict[str, str] = {}
    for job in jobs:
        ctx, persona, plan = prepare(job, library[job.scenario_id], config)
        payload = json.loads(
            dialogue_json(plan_following_turns(plan, library[job.scenario_id].opening))
        )
        if job.id == jobs[0].id:  # a malformed newWords item: a failure before sanitising
            payload["turns"][0]["output"]["annotations"]["newWords"] = [{"lemma": "cornetto"}]
        payloads[make_brief(ctx, persona, plan)] = json.dumps(payload)

    def respond(messages: Sequence[ChatMessage]) -> str:
        return payloads[messages[0]["content"]]

    ok, failed = run_generate(config, scenarios, ScriptedClient(respond))
    assert (ok, failed) == (4, 0)  # sanitising already rescues the first job
    paths = RunPaths(tmp_path)

    # Simulate a round-1 failure row with the teacher's text, and a stale judged row.
    raw = list(read_jsonl(paths.raw))
    first = next(r for r in raw if r["id"] == jobs[0].id)
    write_jsonl(paths.raw, [r for r in raw if r["id"] != jobs[0].id])
    text = dialogue_json(DialogueRecord.model_validate(first).turns)
    write_jsonl(paths.failed, [{"id": jobs[0].id, "error": "old parser", "text": text}])
    stale = copy.deepcopy(raw[1])
    write_jsonl(paths.judged, [stale, {**stale, "id": "gone"}])
    assert len(pending_jobs(config, scenarios)) == 1

    counts = run_refilter(
        config, scenarios, band_checker=checker, grammar=NullChecker(), reparse_failed=True
    )
    assert counts["recovered"] == 1 and counts["total"] == 4
    assert pending_jobs(config, scenarios) == []
    passing = {r["id"] for r in read_jsonl(paths.filtered) if r.get("filter", {}).get("passed")}
    judged = [r["id"] for r in read_jsonl(paths.judged)]
    assert "gone" not in judged
    assert set(judged) <= passing
    assert counts["judged dropped"] == 2 - len(judged)
