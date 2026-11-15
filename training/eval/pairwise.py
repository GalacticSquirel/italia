"""Judge-model pairwise win rates with position swapping and Wilson confidence intervals."""

from __future__ import annotations

import math
import random
from collections.abc import Sequence
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

from datagen.judge import JudgeParseError, judge_pairwise
from datagen.teacher import ChatClient
from eval.items import EvalItem


@dataclass(frozen=True)
class WinRate:
    system: str
    opponent: str
    comparisons: int
    win_rate: float
    """Mean score: 1 win, 0.5 tie or position-inconsistent verdict, 0 loss."""
    low: float
    high: float
    failed: int = 0


def wilson_interval(successes: float, n: int, z: float = 1.96) -> tuple[float, float]:
    if n == 0:
        return (0.0, 1.0)
    p = successes / n
    denom = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denom
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    return (max(0.0, centre - half), min(1.0, centre + half))


def win_rate_from_scores(
    system: str, opponent: str, scores: Sequence[float], failed: int = 0
) -> WinRate:
    n = len(scores)
    total = sum(scores)
    low, high = wilson_interval(total, n)
    return WinRate(system, opponent, n, total / n if n else 0.0, low, high, failed)


def compare(
    system: str,
    opponent: str,
    items: Sequence[EvalItem],
    ours: dict[str, str],
    theirs: dict[str, str],
    *,
    judge: ChatClient,
    sample: int | None = None,
    seed: int = 0,
    workers: int = 8,
) -> WinRate:
    """Win rate of `system` against `opponent` on items both have predictions for."""
    pool_items = [i for i in items if i.id in ours and i.id in theirs]
    if sample is not None and sample < len(pool_items):
        pool_items = random.Random(seed).sample(pool_items, sample)

    def one(item: EvalItem) -> float | None:
        try:
            outcome, _ = judge_pairwise(
                item.messages, ours[item.id], theirs[item.id], level=item.level.value, client=judge
            )
        except (JudgeParseError, RuntimeError):
            return None
        return outcome.score

    with ThreadPoolExecutor(max_workers=workers) as pool:
        results = list(pool.map(one, pool_items))
    scores = [r for r in results if r is not None]
    return win_rate_from_scores(system, opponent, scores, failed=len(results) - len(scores))
