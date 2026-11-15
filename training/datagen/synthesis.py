"""Multi-turn dialogue synthesis with the teacher model.

One teacher call writes a whole dialogue (much cheaper than one call per turn, whose context grows
quadratically), following a plan fixed in advance by the learner simulator. An optional second
call critiques and fixes the dialogue. The tutor's side is written against the exact system prompt
the student will be trained on.
"""

from __future__ import annotations

import json
import random
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
    pass


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
- A prompt reply must NOT give the answer away; it repeats the wrong part as a question or gives
  a short hint in Italian, then waits.
- newWords lists only lemmas above the learner's word limit that the reply uses on purpose.
- scenarioProgress.goalsCompleted is cumulative and only uses goal ids from the instructions.
- The tutor's Italian must be flawless, natural, and inside the level limits.

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
ids), (5) prompts that give the answer away. Check that LEARNER turns contain the planned errors
and no others.

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


def parse_dialogue(text: str, n_learner: int) -> list[Turn]:
    """Validate the teacher's JSON into turns (tutor first and last, alternating)."""
    try:
        raw = extract_json_object(text)
    except JsonExtractError as err:
        raise SynthesisError(str(err)) from err
    items: Any = raw.get("turns")
    if not isinstance(items, list):
        raise SynthesisError("missing 'turns' list")
    turns: list[Turn] = []
    try:
        for item in items:
            if not isinstance(item, dict):
                raise SynthesisError("turn is not an object")
            if item.get("role") == "tutor":
                turns.append(Turn.tutor(TutorOutput.model_validate(item.get("output"))))
            elif item.get("role") == "learner":
                turns.append(Turn.learner(str(item.get("text", ""))))
            else:
                raise SynthesisError(f"unknown role {item.get('role')!r}")
    except ValidationError as err:
        raise SynthesisError(f"schema error: {err.errors()[0]['msg']}") from err
    roles = [t.role for t in turns]
    expected = ["tutor", "learner"] * n_learner + ["tutor"]
    if roles != expected:
        raise SynthesisError(
            f"expected {len(expected)} alternating turns starting and ending with the tutor, "
            f"got {len(roles)}"
        )
    return turns


def dialogue_json(turns: list[Turn]) -> str:
    rows: list[dict[str, object]] = []
    for t in turns:
        if t.output is not None:
            rows.append({"role": "tutor", "output": t.output.to_wire()})
        else:
            rows.append({"role": "learner", "text": t.text})
    return json.dumps({"turns": rows}, ensure_ascii=False)


def synthesize(
    job: Job,
    scenario: Scenario,
    config: DatagenConfig,
    teacher: ChatClient,
) -> DialogueRecord:
    """Write (and optionally revise) one dialogue for `job`."""
    context, persona, plan = prepare(job, scenario, config)
    brief = make_brief(context, persona, plan)
    messages: list[ChatMessage] = [{"role": "user", "content": brief}]
    completion = teacher.complete(
        messages,
        temperature=config.teacher_temperature,
        max_tokens=config.teacher_max_tokens,
        json_output=True,
    )
    usage: Usage = completion.usage
    turns = parse_dialogue(completion.text, len(plan))
    revised = False
    if config.revise_pass:
        review: list[ChatMessage] = [
            {
                "role": "user",
                "content": _REVISE_INSTRUCTIONS.format(brief=brief, dialogue=dialogue_json(turns)),
            }
        ]
        fixed = teacher.complete(
            review, temperature=0.2, max_tokens=config.teacher_max_tokens, json_output=True
        )
        usage = usage + fixed.usage
        turns = parse_dialogue(fixed.text, len(plan))
        revised = True
    return DialogueRecord(
        id=job.id,
        spec_version=SPEC_VERSION,
        split=job.split,
        scenario_id=scenario.id,
        level=job.level,
        persona=persona,
        context=context,
        plan=plan,
        turns=turns,
        teacher=teacher.name,
        usage=usage,
        revised=revised,
    )
