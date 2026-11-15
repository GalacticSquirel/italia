"""Render the tutor's system prompt and chat messages from a `TutorContext`.

The same renderer produces training inputs, evaluation inputs and (ported to TypeScript) the app's
runtime prompt, so the student always sees exactly the prompt it was trained on. Keep the prompt
short: on the phone, time to first token is dominated by prefilling it.
"""

from __future__ import annotations

from collections.abc import Sequence
from string import Template
from typing import Literal, TypedDict

from spec.levels import band_for
from spec.models import START_MESSAGE, Turn, TutorContext
from spec.taxonomy import SPEC_DIR, error_tags, grammar_points, grammar_up_to, tags_for_level

TEMPLATE_FILE = SPEC_DIR / "system_prompt.v1.txt"


class ChatMessage(TypedDict):
    role: Literal["system", "user", "assistant"]
    content: str


def _template() -> Template:
    return Template(TEMPLATE_FILE.read_text(encoding="utf-8"))


def allowed_grammar_slugs(context: TutorContext) -> list[str]:
    """The learner's unlocked grammar points, or every point up to their level."""
    level = context.learner.level
    if context.learner.known_grammar:
        points = grammar_points()
        unknown = [s for s in context.learner.known_grammar if s not in points]
        if unknown:
            raise ValueError(f"unknown grammar points: {unknown}")
        return list(context.learner.known_grammar)
    return [p.slug for p in grammar_up_to(level)]


def render_system_prompt(context: TutorContext) -> str:
    """The system prompt for one conversation."""
    learner = context.learner
    scenario = context.scenario
    band = band_for(learner.level, learner.lemma_ceiling)
    points = grammar_points()
    grammar = "; ".join(points[s].title for s in allowed_grammar_slugs(context))
    goals = "\n".join(f"{i}. [{g.id}] {g.description}" for i, g in enumerate(scenario.goals, 1))
    register_rule = (
        "Lei (formal) with the learner."
        if scenario.formality == "formal"
        else "tu (informal) with the learner."
    )
    english_rule = (
        " You may add one English word in brackets to explain a new word."
        if band.english_allowed
        else ""
    )
    taxonomy = error_tags()
    history_block = ""
    if learner.error_history:
        items = ", ".join(
            f"{taxonomy[h.tag].label} ({h.tag}, {h.count}x)" for h in learner.error_history
        )
        history_block = f"Recurring learner errors (watch for these first): {items}\n"
    level_tags = ", ".join(t.id for t in tags_for_level(learner.level))
    return _template().substitute(
        level=learner.level.value,
        tutor_role=scenario.tutor_role,
        setting=scenario.setting,
        learner_role=scenario.learner_role,
        register_rule=register_rule,
        goals=goals,
        key_vocab=", ".join(scenario.key_vocab),
        english_rule=english_rule,
        lemma_ceiling=band.lemma_ceiling,
        max_new_words=band.max_new_words,
        max_sentences=band.max_sentences,
        max_words=band.max_words_per_sentence,
        grammar=grammar,
        history_block=history_block,
        error_tags=level_tags,
    )


def render_messages(context: TutorContext, turns: Sequence[Turn]) -> list[ChatMessage]:
    """System prompt plus the dialogue as chat messages (tutor turns as their JSON output)."""
    messages: list[ChatMessage] = [
        {"role": "system", "content": render_system_prompt(context)},
        {"role": "user", "content": START_MESSAGE},
    ]
    expected: Literal["tutor", "learner"] = "tutor"
    for turn in turns:
        if turn.role != expected:
            raise ValueError("turns must alternate, starting with the tutor")
        if turn.output is not None:
            messages.append({"role": "assistant", "content": turn.output.to_json()})
            expected = "learner"
        else:
            messages.append({"role": "user", "content": turn.text})
            expected = "tutor"
    return messages
