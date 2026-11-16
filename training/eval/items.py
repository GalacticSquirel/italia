"""Evaluation items: one per tutor reaction in the held-out dialogues.

Each item is the conversation up to a learner turn, the teacher's tutor turn as the reference,
and gold labels from the learner-simulator plan (the injected error and the policy's move).
Items come only from `split: eval` scenarios, which no training set ever contains.
"""

from __future__ import annotations

from collections.abc import Iterable

from pydantic import Field

from datagen.records import DialogueRecord
from spec.levels import Level
from spec.models import FeedbackMove, TutorContext, WireModel
from spec.render import render_messages


class Gold(WireModel):
    expected_move: FeedbackMove
    target_tag: str | None = None
    injected_tags: list[str] = Field(default_factory=list)

    @property
    def tags(self) -> set[str]:
        """Tags a correct tutor turn carries (none when no correction is due)."""
        if self.expected_move == "none" or self.target_tag is None:
            return set()
        return {self.target_tag}


class EvalItem(WireModel):
    id: str
    dialogue_id: str
    level: Level
    scenario_id: str
    context: TutorContext
    messages: list[dict[str, str]]
    learner_text: str
    reference: str
    gold: Gold


def build_items(
    records: Iterable[DialogueRecord], *, max_per_dialogue: int | None = None
) -> list[EvalItem]:
    items: list[EvalItem] = []
    for record in records:
        if record.split != "eval":
            raise ValueError(f"dialogue {record.id} is not from an eval scenario")
        messages = render_messages(record.context, record.turns)
        plans = list(enumerate(record.plan))
        if max_per_dialogue is not None:
            plans = plans[:max_per_dialogue]
        for k, plan in plans:
            cut = 2 + 2 * (k + 1)
            items.append(
                EvalItem(
                    id=f"{record.id}:{k}",
                    dialogue_id=record.id,
                    level=record.level,
                    scenario_id=record.scenario_id,
                    context=record.context,
                    messages=[{"role": m["role"], "content": m["content"]} for m in messages[:cut]],
                    learner_text=messages[cut - 1]["content"],
                    reference=messages[cut]["content"],
                    gold=Gold(
                        expected_move=plan.expected_move,
                        target_tag=plan.target_tag,
                        injected_tags=plan.error_tags,
                    ),
                )
            )
    return items
