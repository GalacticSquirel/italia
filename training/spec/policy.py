"""The corrective-feedback policy: prompt first, recast second, one error per turn.

Research basis (see the speaking research notes): prompts that push self-repair beat recasts;
correct selectively (one salient error per turn) because over-correction raises anxiety; never
correct a turn that has no error. This module is the single definition of the policy, used to
write gold labels for synthetic dialogues, to filter teacher output, and to score the student.
"""

from __future__ import annotations

from collections.abc import Collection, Sequence

from spec.models import FeedbackMove, Scenario, TutorOutput
from spec.taxonomy import error_tags

MEANING_CRITICAL_KINDS = frozenset({"lexical"})
"""Error kinds that can block understanding; these are recast at once instead of prompted."""


def pick_target_error(
    tags: Sequence[str],
    scenario: Scenario | None = None,
    history_tags: Sequence[str] = (),
) -> str | None:
    """Choose the one error to address.

    Priority: the scenario's grammar focus, then the learner's recurring errors, then taxonomy
    order.
    """
    if not tags:
        return None
    taxonomy = error_tags()
    known = [t for t in tags if t in taxonomy]
    if not known:
        return None
    focus = set(scenario.grammar_focus) if scenario else set()

    def priority(tag: str) -> tuple[int, int, int]:
        info = taxonomy[tag]
        in_focus = 0 if focus.intersection(info.grammar_points) else 1
        recurring = 0 if tag in history_tags else 1
        return (in_focus, recurring, list(taxonomy).index(tag))

    return min(known, key=priority)


def prompted_tags(previous_tutor: TutorOutput | None) -> list[str]:
    """Tags the previous tutor turn prompted on (empty if it did not prompt)."""
    if previous_tutor is None or previous_tutor.annotations.prompt is None:
        return []
    return list(previous_tutor.annotations.prompt.error_tags)


def expected_move(
    current_tags: Collection[str],
    prompted: Collection[str] = (),
) -> FeedbackMove:
    """The move the tutor should make after a learner turn with `current_tags` errors.

    `prompted` holds the tags the previous tutor turn prompted on (see `prompted_tags`).

    - no error: no correction ("none")
    - the previous tutor turn prompted on one of these errors and it is still there: recast
    - a meaning-critical (lexical) error: recast straight away
    - otherwise: prompt
    """
    if not current_tags:
        return "none"
    if set(prompted).intersection(current_tags):
        return "recast"
    taxonomy = error_tags()
    kinds = {taxonomy[t].kind for t in current_tags if t in taxonomy}
    if kinds and kinds <= MEANING_CRITICAL_KINDS:
        return "recast"
    return "prompt"
