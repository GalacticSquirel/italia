"""Multi-turn dialogue synthesis with the teacher model.

One teacher call writes a whole dialogue (much cheaper than one call per turn, whose context grows
quadratically), following a plan fixed in advance by the learner simulator. An optional second
call critiques and fixes the dialogue. The tutor's side is written against the exact system prompt
the student will be trained on.
"""

from __future__ import annotations

import json
import random
from dataclasses import dataclass, field
from functools import cache
from typing import Any

from pydantic import ValidationError

from datagen.config import DatagenConfig
from datagen.jsonutil import JsonExtractError, extract_json_object
from datagen.learner import PERSONAS_BY_ID, build_profile, plan_learner_turns
from datagen.records import DialogueRecord, Job, LearnerTurnPlan, Persona
from datagen.teacher import ChatClient, Usage
from spec.models import (
    SPEC_VERSION,
    Scenario,
    Turn,
    TutorContext,
    TutorOutput,
    output_json_schema,
)
from spec.render import ChatMessage, render_system_prompt
from spec.taxonomy import error_tags, tags_for_level


class SynthesisError(ValueError):
    """The teacher's output is unusable; `problems` are fed back in the repair turn."""

    def __init__(self, message: str, problems: list[str] | None = None) -> None:
        super().__init__(message)
        self.problems = problems or [message]
        self.text: str | None = None  # the last unusable teacher output, kept for reparsing
        self.usage: Usage | None = None  # tokens spent on the failed attempt, repairs included


_L1_NAMES = {"en": "English", "es": "Spanish"}

_WRITER_INSTRUCTIONS = """\
You write training data for a small Italian tutoring model that runs on a phone. Write one complete
role-play dialogue between the TUTOR and a LEARNER of Italian.

The TUTOR must follow its instructions exactly. These are the instructions it receives:
<tutor_instructions>
{system_prompt}
</tutor_instructions>

The LEARNER is {persona} (first language: {l1}, gender: {gender}, level {level}). Write the
learner's lines as such a learner would: only Italian, short and simple at low levels, with
believable {l1}-speaker mistakes ONLY where the plan below asks for them. Everything else the
learner says must be correct Italian. Learner gender matters for agreement (sono andato/andata).

Dialogue plan ({n_learner} learner turns; the tutor speaks first and last, so there are
{n_tutor} tutor turns):
- Tutor turn 1 opens the scene, starting from: "{opening}"
{plan_lines}
- The final tutor turn closes the scene naturally and sets scenarioProgress.done to true if all
  goals are completed (otherwise false).

Rules for tutor annotations:
- prompt / recast: learnerText is copied character-for-character from the learner's last turn
  (the shortest span containing the error); errorTags use only these ids: {tag_ids}.
- recast.correctedText is the same span, corrected. The reply must contain the corrected form.
- A prompt reply must NOT give the answer away: it must not contain the corrected form, nor
  offer the right choice. It repeats the wrong part as a question or gives a short hint in
  Italian, then waits.
    Learner: "La mia cucina piccolo."
    WRONG prompt: "Come si dice la cucina piccola?" (contains the correction)
    WRONG prompt: "Piccolo o piccola?" (offers the answer)
    RIGHT prompt: "La cucina piccolo? Cucina è femminile..."
- newWords lists only lemmas above the learner's word limit that the reply uses on purpose.
- scenarioProgress.goalsCompleted is cumulative and only uses goal ids from the instructions.
- The tutor's Italian must be flawless, natural, and inside the level limits. Two mistakes
  to avoid in particular:
    c'è / ci sono agrees with the first noun after it.
      WRONG: "Ci sono un balcone e due camere."  RIGHT: "C'è un balcone e ci sono due camere."
    A preposition the verb needs goes BEFORE an interrogative or relative pronoun.
      WRONG: "Quale fermata deve scendere?"  RIGHT: "A quale fermata deve scendere?"
      WRONG: "La città che abito è grande."  RIGHT: "La città in cui abito è grande."

Return only JSON, no commentary, in exactly this shape:
{{"turns": [{{"role": "tutor", "output": <tutor JSON>}},
            {{"role": "learner", "text": "..."}}, ...]}}
where <tutor JSON> follows this JSON Schema:
{schema}
"""

_REVISE_INSTRUCTIONS = """\
You are checking a training dialogue for an Italian tutoring model. The dialogue was written from
the brief below. Check every TUTOR turn for: (1) any Italian mistake, (2) words or sentences
beyond the level limits, (3) not following the plan's feedback move (none / prompt / recast),
(4) annotation errors (learnerText not copied exactly, wrong tags, wrong correctedText, wrong goal
ids), (5) prompts that give the answer away (a prompt must not contain the corrected form or
offer the right choice), (6) c'è / ci sono not agreeing with the first noun after it, and a
missing preposition before an interrogative or relative pronoun ("A quale fermata...?", "in
cui"). Check that LEARNER turns contain the planned errors and no others.

Fix every problem you find with the smallest possible edit. Keep everything that is already
correct unchanged. Return the full corrected dialogue as JSON in the same shape, and nothing else.

<brief>
{brief}
</brief>

<dialogue>
{dialogue}
</dialogue>
"""


def _plan_line(index: int, plan: LearnerTurnPlan) -> str:
    taxonomy = error_tags()
    n = index + 1
    if plan.kind == "repair-success":
        learner = "correctly fixes the error the tutor just prompted on; no other errors"
    elif plan.kind == "repair-fail":
        tag = taxonomy[plan.error_tags[0]]
        learner = f"tries again but still gets it wrong ({tag.id}: {tag.description})"
    elif plan.error_tags:
        described = "; ".join(
            f"{taxonomy[t].id}: {taxonomy[t].description} "
            f'(e.g. "{taxonomy[t].example_wrong}" instead of "{taxonomy[t].example_right}")'
            for t in plan.error_tags
        )
        learner = f"makes exactly these errors: {described}"
    else:
        learner = "makes no errors at all"
    if plan.expected_move == "none":
        tutor = "no correction (prompt and recast are null); continue the scene"
        if plan.kind == "repair-success":
            tutor = "briefly acknowledges the fix (e.g. Esatto!), no correction; continue"
    elif plan.expected_move == "prompt":
        tutor = f'uses a PROMPT on "{plan.target_tag}" only'
    else:
        tutor = f'uses a RECAST on "{plan.target_tag}" only, then continues the scene'
    return f"- Learner turn {n}: {learner}.\n- Tutor turn {n + 1}: {tutor}."


def make_brief(context: TutorContext, persona: Persona, plan: list[LearnerTurnPlan]) -> str:
    schema = json.dumps(output_json_schema(), ensure_ascii=False, separators=(",", ":"))
    tags = ", ".join(t.id for t in tags_for_level(context.learner.level))
    return _WRITER_INSTRUCTIONS.format(
        system_prompt=render_system_prompt(context),
        persona=persona.description,
        l1=_L1_NAMES[persona.l1],
        gender="female" if persona.gender == "f" else "male",
        level=context.learner.level.value,
        n_learner=len(plan),
        n_tutor=len(plan) + 1,
        opening=context.scenario.opening,
        plan_lines="\n".join(_plan_line(i, p) for i, p in enumerate(plan)),
        tag_ids=tags,
        schema=schema,
    )


def prepare(
    job: Job, scenario: Scenario, config: DatagenConfig
) -> tuple[TutorContext, Persona, list[LearnerTurnPlan]]:
    """Context, persona and plan for a job; deterministic in the job seed."""
    rng = random.Random(job.seed)
    profile = build_profile(job.level, scenario, config.learner, rng)
    context = TutorContext(learner=profile, scenario=scenario)
    min_learner = max(2, config.turns.min // 2)  # 2n + 1 turns in total
    max_learner = max(min_learner, (config.turns.max - 1) // 2)
    n = rng.randint(min_learner, max_learner)
    plan = plan_learner_turns(
        level=job.level,
        scenario=scenario,
        profile=profile,
        n_turns=n,
        config=config.learner,
        rng=rng,
    )
    return context, PERSONAS_BY_ID[job.persona_id], plan


@cache
def _known_tags() -> frozenset[str]:
    return frozenset(error_tags())


def _same(a: object, b: object) -> bool:
    def norm(x: object) -> str:
        return " ".join(str(x).lower().replace("\u2019", "'").strip(" .,!?;:").split())

    return norm(a) == norm(b)


def sanitize_output(raw: Any, goal_ids: set[str]) -> tuple[Any, list[str]]:
    """Drop invalid annotation items, keeping the turn when its text is fine.

    - a recast whose correctedText equals its learnerText (no correction at all): dropped
    - unknown error tags: removed; a prompt or recast left with no tag: dropped
    - malformed newWords items (missing lemma or gloss): dropped; more than 3: truncated
    - unknown goal ids in goalsCompleted: removed
    Anything else (no reply, a prompt and a recast together, ...) is left for validation.
    """
    notes: list[str] = []
    if not isinstance(raw, dict) or not isinstance(raw.get("annotations"), dict):
        return raw, notes
    out = dict(raw)
    ann = dict(out["annotations"])
    out["annotations"] = ann
    for key in ("prompt", "recast"):
        item = ann.get(key)
        if not isinstance(item, dict):
            continue
        item = dict(item)
        tags = item.get("errorTags")
        if isinstance(tags, list):
            kept = [t for t in tags if t in _known_tags()]
            if len(kept) != len(tags):
                notes.append(f"{key}: dropped unknown tags {[t for t in tags if t not in kept]}")
            item["errorTags"] = kept[:2]
            if not kept:
                notes.append(f"{key}: dropped (no valid error tag)")
                ann[key] = None
                continue
        if key == "recast" and _same(item.get("correctedText", ""), item.get("learnerText", "")):
            notes.append("recast: dropped (correctedText equals learnerText)")
            ann[key] = None
            continue
        ann[key] = item
    words = ann.get("newWords")
    if isinstance(words, list):
        good = [
            w
            for w in words
            if isinstance(w, dict)
            and isinstance(w.get("lemma"), str)
            and w["lemma"].strip()
            and isinstance(w.get("glossEn"), str)
            and w["glossEn"].strip()
        ]
        if len(good) != len(words):
            notes.append(f"newWords: dropped {len(words) - len(good)} malformed item(s)")
        if len(good) > 3:
            notes.append("newWords: truncated to 3")
        ann["newWords"] = [{"lemma": w["lemma"], "glossEn": w["glossEn"]} for w in good[:3]]
    progress = ann.get("scenarioProgress")
    if isinstance(progress, dict) and isinstance(progress.get("goalsCompleted"), list):
        goals = progress["goalsCompleted"]
        kept_goals = [g for g in goals if g in goal_ids]
        if len(kept_goals) != len(goals):
            notes.append(f"goalsCompleted: dropped {[g for g in goals if g not in goal_ids]}")
            ann["scenarioProgress"] = {**progress, "goalsCompleted": kept_goals}
    return out, notes


@dataclass(frozen=True)
class ParsedDialogue:
    turns: list[Turn]
    plan: list[LearnerTurnPlan]
    notes: list[str] = field(default_factory=list)


_EXTRA_EXCHANGE = LearnerTurnPlan(
    kind="fresh", error_tags=[], target_tag=None, expected_move="none"
)


def _location(index: int) -> str:
    return f"turns[{index}]"


def _parse_items(items: list[Any], goal_ids: set[str]) -> tuple[list[Turn], list[str], list[str]]:
    """Turns, problems (for the repair turn) and sanitising notes from the raw turn list."""
    turns: list[Turn] = []
    problems: list[str] = []
    notes: list[str] = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            problems.append(f"{_location(index)} is not an object")
            continue
        role = item.get("role")
        if role == "tutor":
            output, item_notes = sanitize_output(item.get("output"), goal_ids)
            notes.extend(f"{_location(index)} {n}" for n in item_notes)
            try:
                turns.append(Turn.tutor(TutorOutput.model_validate(output)))
            except ValidationError as err:
                for e in err.errors()[:3]:
                    where = ".".join(str(p) for p in e["loc"])
                    problems.append(f"{_location(index)}.output.{where}: {e['msg']}".rstrip("."))
        elif role == "learner":
            learner = str(item.get("text", "")).strip()
            if not learner:
                problems.append(f"{_location(index)}: learner text is empty")
            else:
                turns.append(Turn.learner(learner))
        else:
            problems.append(f"{_location(index)}: unknown role {role!r}")
    return turns, problems, notes


def parse_dialogue(
    text: str, plan: list[LearnerTurnPlan], goal_ids: set[str] | None = None
) -> ParsedDialogue:
    """Validate the teacher's JSON into turns (tutor first and last, alternating).

    Collects every problem it can find (for the repair turn) instead of stopping at the first.
    Invalid annotation items are dropped by `sanitize_output` rather than failing the dialogue.

    Turn-count tolerance: one learner exchange more or fewer than planned is accepted only when
    the final tutor turn marks the scenario done (the goal was reached) and every turn is
    otherwise valid. With one fewer, the plan's last step is dropped; with one more, the extra
    exchange is planned as an error-free learner turn that gets no correction, which the policy
    filter then enforces. Anything further off is an error.
    """
    try:
        raw = extract_json_object(text)
    except JsonExtractError as err:
        raise SynthesisError(str(err), [f"the reply is not one JSON object: {err}"]) from err
    items: Any = raw.get("turns")
    if not isinstance(items, list):
        raise SynthesisError("missing 'turns' list", ["the top-level object needs a 'turns' list"])
    turns, problems, notes = _parse_items(items, goal_ids or set())
    if problems:
        raise SynthesisError(f"schema error: {problems[0]}", problems)

    roles = [t.role for t in turns]
    alternating = (
        bool(roles)
        and roles[0] == "tutor"
        and roles[-1] == "tutor"
        and all(r == ("tutor" if i % 2 == 0 else "learner") for i, r in enumerate(roles))
    )
    n_planned = len(plan)
    n_learner = roles.count("learner")
    if not alternating:
        raise SynthesisError(
            "turns do not alternate",
            ["turns must alternate tutor/learner, starting and ending with the tutor"],
        )
    if n_learner == n_planned:
        return ParsedDialogue(turns, list(plan), notes)
    last = turns[-1].output
    done = last is not None and last.annotations.scenario_progress.done
    if abs(n_learner - n_planned) == 1 and done and n_planned > 1:
        if n_learner < n_planned:
            notes.append(f"accepted {n_learner} learner turns for {n_planned} planned (done)")
            return ParsedDialogue(turns, list(plan[:-1]), notes)
        notes.append(f"accepted {n_learner} learner turns for {n_planned} planned (done)")
        return ParsedDialogue(turns, [*plan, _EXTRA_EXCHANGE], notes)
    raise SynthesisError(
        f"expected {2 * n_planned + 1} alternating turns starting and ending with the tutor, "
        f"got {len(roles)}",
        [
            f"there must be exactly {n_planned} learner turns and {n_planned + 1} tutor turns "
            f"({2 * n_planned + 1} in total), one per line of the plan; you wrote {n_learner} "
            "learner turns"
        ],
    )


_REPAIR_INSTRUCTIONS = """Your JSON could not be used. Problems found:
{problems}

Return the complete corrected dialogue as one JSON object in the same shape, following the plan
exactly ({n_learner} learner turns, {n_tutor} tutor turns, alternating, tutor first and last).
Keep everything that was already correct. Return only JSON.
"""


def repair_message(problems: list[str], n_learner: int) -> str:
    listed = "\n".join(f"- {p}" for p in problems[:12])
    return _REPAIR_INSTRUCTIONS.format(problems=listed, n_learner=n_learner, n_tutor=n_learner + 1)


def dialogue_json(turns: list[Turn]) -> str:
    rows: list[dict[str, object]] = []
    for t in turns:
        if t.output is not None:
            rows.append({"role": "tutor", "output": t.output.to_wire()})
        else:
            rows.append({"role": "learner", "text": t.text})
    return json.dumps({"turns": rows}, ensure_ascii=False)


def _draft(
    messages: list[ChatMessage],
    plan: list[LearnerTurnPlan],
    goal_ids: set[str],
    config: DatagenConfig,
    teacher: ChatClient,
    *,
    temperature: float,
) -> tuple[ParsedDialogue, Usage, bool]:
    """One teacher call, plus up to `repairAttempts` repair turns in the same conversation."""
    completion = teacher.complete(
        messages, temperature=temperature, max_tokens=config.teacher_max_tokens, json_output=True
    )
    usage = completion.usage
    conversation = list(messages)
    text = completion.text
    for attempt in range(config.repair_attempts + 1):
        try:
            return parse_dialogue(text, plan, goal_ids), usage, attempt > 0
        except SynthesisError as err:
            if attempt == config.repair_attempts:
                err.text = text
                err.usage = usage
                raise
            conversation += [
                {"role": "assistant", "content": text},
                {"role": "user", "content": repair_message(err.problems, len(plan))},
            ]
            fixed = teacher.complete(
                conversation,
                temperature=0.2,
                max_tokens=config.teacher_max_tokens,
                json_output=True,
            )
            usage = usage + fixed.usage
            text = fixed.text
    raise AssertionError("unreachable")


def synthesize(
    job: Job,
    scenario: Scenario,
    config: DatagenConfig,
    teacher: ChatClient,
) -> DialogueRecord:
    """Write (and optionally revise) one dialogue for `job`.

    A draft that fails validation gets a repair turn: the specific problems go back to the
    teacher in the same conversation (bounded by `repairAttempts`) before the attempt counts as
    failed. A revision that cannot be parsed even after repair keeps the unrevised dialogue.
    """
    context, persona, plan = prepare(job, scenario, config)
    goal_ids = {g.id for g in scenario.goals}
    brief = make_brief(context, persona, plan)
    messages: list[ChatMessage] = [{"role": "user", "content": brief}]
    parsed, usage, repaired = _draft(
        messages, plan, goal_ids, config, teacher, temperature=config.teacher_temperature
    )
    revised = False
    if config.revise_pass:
        review: list[ChatMessage] = [
            {
                "role": "user",
                "content": _REVISE_INSTRUCTIONS.format(
                    brief=brief, dialogue=dialogue_json(parsed.turns)
                ),
            }
        ]
        try:
            fixed, more, fixed_repaired = _draft(
                review, parsed.plan, goal_ids, config, teacher, temperature=0.2
            )
        except SynthesisError as err:
            if err.usage is not None:
                usage = usage + err.usage
            parsed = ParsedDialogue(
                parsed.turns, parsed.plan, [*parsed.notes, f"revision unusable: {err}"]
            )
        else:
            usage = usage + more
            parsed, revised = fixed, True
            repaired = repaired or fixed_repaired
    return DialogueRecord(
        id=job.id,
        spec_version=SPEC_VERSION,
        split=job.split,
        scenario_id=scenario.id,
        level=job.level,
        persona=persona,
        context=context,
        plan=parsed.plan,
        turns=parsed.turns,
        teacher=teacher.name,
        usage=usage,
        revised=revised,
        repaired=repaired,
        parse_notes=parsed.notes,
    )
