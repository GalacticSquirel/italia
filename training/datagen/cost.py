"""Expected token usage and cost of a data-generation run, printed before anything is spent.

Input tokens are measured from the real prompts of a sample of jobs (the briefs are rendered
exactly as the run would send them) at `estimate.charsPerToken`; output tokens use per-level turn
sizes. The estimate covers generation, the optional revise pass, and the judge pass, and grosses up
for dialogues the filters will reject (`estimate.expectedPassRate`).
"""

from __future__ import annotations

import random
from dataclasses import dataclass

from datagen.config import DatagenConfig
from datagen.records import Job
from datagen.synthesis import make_brief, prepare
from datagen.teacher import Pricing, Usage
from spec.models import Scenario

_REVISE_OVERHEAD_TOKENS = 450  # the review instructions around the brief and dialogue
_JUDGE_PROMPT_TOKENS = 700  # rubric and framing around the system prompt and dialogue


@dataclass(frozen=True)
class StageEstimate:
    name: str
    calls: int
    usage: Usage
    cost_usd: float


@dataclass(frozen=True)
class CostEstimate:
    jobs: int
    accepted_dialogues: int
    stages: list[StageEstimate]

    @property
    def total_usage(self) -> Usage:
        total = Usage()
        for stage in self.stages:
            total = total + stage.usage
        return total

    @property
    def total_cost(self) -> float:
        return sum(s.cost_usd for s in self.stages)

    def table(self) -> str:
        lines = [
            f"Jobs to run: {self.jobs:,} (expected to keep ~{self.accepted_dialogues:,} "
            "after filters)",
            f"{'stage':<10} {'calls':>9} {'input tok':>14} {'output tok':>14} {'cost USD':>11}",
        ]
        for s in self.stages:
            lines.append(
                f"{s.name:<10} {s.calls:>9,} {s.usage.input_tokens:>14,} "
                f"{s.usage.output_tokens:>14,} {s.cost_usd:>11,.2f}"
            )
        t = self.total_usage
        lines.append(
            f"{'total':<10} {'':>9} {t.input_tokens:>14,} {t.output_tokens:>14,} "
            f"{self.total_cost:>11,.2f}"
        )
        return "\n".join(lines)


def _scale(usage: Usage, factor: float) -> Usage:
    return Usage(
        input_tokens=round(usage.input_tokens * factor),
        output_tokens=round(usage.output_tokens * factor),
    )


def estimate_cost(
    config: DatagenConfig,
    jobs: list[Job],
    scenarios: dict[str, Scenario],
    *,
    sample_size: int = 200,
) -> CostEstimate:
    """Estimate the cost of running `jobs` (pass only the jobs that are not done yet)."""
    est = config.estimate
    sample = jobs if len(jobs) <= sample_size else random.Random(0).sample(jobs, sample_size)
    gen = Usage()
    rev = Usage()
    jud = Usage()
    for job in sample:
        context, persona, plan = prepare(job, scenarios[job.scenario_id], config)
        brief_tokens = round(len(make_brief(context, persona, plan)) / est.chars_per_token)
        n_learner = len(plan)
        dialogue_tokens = (
            (n_learner + 1) * est.tutor_turn_tokens[job.level]
            + n_learner * est.learner_turn_tokens[job.level]
            + 20
        )
        gen = gen + Usage(input_tokens=brief_tokens, output_tokens=dialogue_tokens)
        rev = rev + Usage(
            input_tokens=brief_tokens + dialogue_tokens + _REVISE_OVERHEAD_TOKENS,
            output_tokens=dialogue_tokens,
        )
        system_tokens = brief_tokens // 2
        jud = jud + Usage(
            input_tokens=system_tokens + dialogue_tokens + _JUDGE_PROMPT_TOKENS,
            output_tokens=est.judge_output_tokens,
        )
    factor = len(jobs) / len(sample) if sample else 0.0
    accepted = round(len(jobs) * est.expected_pass_rate)
    stages = [_stage("generate", len(jobs), _scale(gen, factor), config.teacher.pricing)]
    if config.revise_pass:
        stages.append(_stage("revise", len(jobs), _scale(rev, factor), config.teacher.pricing))
    # Only dialogues that pass the automatic filters are judged.
    judged = est.expected_pass_rate
    stages.append(
        _stage(
            "judge",
            round(len(jobs) * judged),
            _scale(jud, factor * judged),
            config.judge_endpoint.pricing,
        )
    )
    return CostEstimate(jobs=len(jobs), accepted_dialogues=accepted, stages=stages)


def _stage(name: str, calls: int, usage: Usage, pricing: Pricing) -> StageEstimate:
    return StageEstimate(name=name, calls=calls, usage=usage, cost_usd=pricing.cost(usage))
