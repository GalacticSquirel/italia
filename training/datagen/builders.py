"""Dataset builders: SFT conversations, DPO prompts, and preference pairs.

Formats are the conversational formats TRL's SFTTrainer and DPOTrainer read:

- SFT: `{"messages": [system, user, assistant, user, assistant, ...]}`
- DPO: `{"prompt": [messages...], "chosen": [assistant], "rejected": [assistant]}`
"""

from __future__ import annotations

import hashlib
import random
from collections.abc import Iterable, Sequence
from typing import Any

from pydantic import Field

from datagen.filters import parse_tutor_output
from datagen.records import DialogueRecord, JudgeScores
from spec.models import FeedbackMove, WireModel
from spec.render import render_messages


def _bucket(key: str, seed: int) -> float:
    digest = hashlib.sha256(f"{seed}:{key}".encode()).digest()
    return int.from_bytes(digest[:8], "big") / 2**64


def sft_example(record: DialogueRecord) -> dict[str, Any]:
    return {
        "id": record.id,
        "level": record.level.value,
        "scenarioId": record.scenario_id,
        "messages": render_messages(record.context, record.turns),
    }


def build_sft(
    records: Iterable[DialogueRecord],
    *,
    val_fraction: float = 0.02,
    seed: int = 0,
    max_dialogues: int | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Split train-split dialogues into SFT train and validation sets (stable by id).

    Dialogues from evaluation scenarios are never included. `max_dialogues` takes a stable
    subset (used for the base-model bake-off on the first 5k dialogues).
    """
    rows = sorted((r for r in records if r.split == "train"), key=lambda r: _bucket(r.id, seed + 1))
    if max_dialogues is not None:
        rows = rows[:max_dialogues]
    train: list[dict[str, Any]] = []
    val: list[dict[str, Any]] = []
    for record in rows:
        target = val if _bucket(record.id, seed) < val_fraction else train
        target.append(sft_example(record))
    return train, val


class DpoPrompt(WireModel):
    """A dialogue prefix ending with a learner turn; the student writes the next tutor turn."""

    id: str
    dialogue_id: str
    level: str
    messages: list[dict[str, str]]
    reference: str = Field(description="The teacher's tutor turn (JSON).")
    expected_move: FeedbackMove
    target_tag: str | None = None


def build_dpo_prompts(
    records: Iterable[DialogueRecord],
    *,
    per_dialogue: int = 2,
    seed: int = 0,
) -> list[DpoPrompt]:
    """Pick tutor positions for preference tuning, preferring turns that react to errors.

    Turns after an erroneous learner turn teach prompt-vs-recast; turns after a correct learner
    turn teach not over-correcting. Each dialogue contributes up to `per_dialogue` positions,
    errors first, then one correct turn if room is left.
    """
    rng = random.Random(seed)
    prompts: list[DpoPrompt] = []
    for record in records:
        messages = render_messages(record.context, record.turns)
        # messages: system, start, tutor1, learner1, tutor2, ... ; tutor k+1 reacts to plan[k]
        error_positions = [k for k, p in enumerate(record.plan) if p.expected_move != "none"]
        clean_positions = [k for k, p in enumerate(record.plan) if p.expected_move == "none"]
        rng.shuffle(error_positions)
        rng.shuffle(clean_positions)
        chosen = error_positions[: max(per_dialogue - 1, 1)]
        chosen += clean_positions[: per_dialogue - len(chosen)]
        for k in sorted(chosen):
            cut = 2 + 2 * (k + 1)  # up to and including learner turn k
            plan = record.plan[k]
            prompts.append(
                DpoPrompt(
                    id=f"{record.id}:{k}",
                    dialogue_id=record.id,
                    level=record.level.value,
                    messages=[{"role": m["role"], "content": m["content"]} for m in messages[:cut]],
                    reference=messages[cut]["content"],
                    expected_move=plan.expected_move,
                    target_tag=plan.target_tag,
                )
            )
    return prompts


class Candidate(WireModel):
    text: str
    source: str = Field(description="'student' or 'reference'")
    scores: JudgeScores | None = None

    @property
    def valid(self) -> bool:
        output, _errors = parse_tutor_output(self.text)
        return output is not None

    @property
    def score(self) -> float:
        """Judge overall for valid outputs; invalid JSON always ranks last (0)."""
        if not self.valid:
            return 0.0
        return self.scores.overall if self.scores is not None else 0.0


class CandidateSet(WireModel):
    prompt: DpoPrompt
    candidates: list[Candidate]


def build_preference_pairs(
    sets: Sequence[CandidateSet],
    *,
    min_margin: float = 0.5,
    min_chosen_score: float = 4.0,
    max_pairs_per_prompt: int = 2,
) -> list[dict[str, Any]]:
    """Judge-ranked pairs: best candidate vs. each clearly worse one.

    A pair is kept when the chosen candidate is valid, scores at least `min_chosen_score`, and
    beats the rejected one by at least `min_margin`. Ties and near-ties are skipped: they teach
    nothing and add noise. Rejected candidates are taken worst-first.
    """
    pairs: list[dict[str, Any]] = []
    for item in sets:
        ranked = sorted(item.candidates, key=lambda c: c.score, reverse=True)
        if not ranked:
            continue
        best = ranked[0]
        if not best.valid or best.score < min_chosen_score:
            continue
        kept = 0
        for worse in reversed(ranked[1:]):
            if kept >= max_pairs_per_prompt:
                break
            if best.score - worse.score < min_margin or worse.text == best.text:
                continue
            pairs.append(
                {
                    "id": f"{item.prompt.id}:{kept}",
                    "prompt": [dict(m) for m in item.prompt.messages],
                    "chosen": [{"role": "assistant", "content": best.text}],
                    "rejected": [{"role": "assistant", "content": worse.text}],
                    "margin": round(best.score - worse.score, 3),
                }
            )
            kept += 1
    return pairs
