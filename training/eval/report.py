"""Markdown evaluation report: metric table, per-level view, move confusion, win rates, device."""

from __future__ import annotations

import json
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from eval.metrics import MOVES, SystemScores, tag_scores
from eval.pairwise import WinRate

# (key, label, higher is better, format)
METRICS: tuple[tuple[str, str, bool, str], ...] = (
    ("json_validity", "JSON validity", True, "pct"),
    ("lt_errors_per_100_words", "LanguageTool errors / 100 words", False, "num"),
    ("replies_with_lt_error", "Replies with a LanguageTool error", False, "pct"),
    ("out_of_band_token_rate", "Tokens outside the level band", False, "pct"),
    ("replies_over_band", "Replies over the band limit", False, "pct"),
    ("sentences_over_limit", "Replies with an over-long sentence", False, "pct"),
    ("italian_only", "Italian-only replies", True, "pct"),
    ("move_accuracy", "Feedback move accuracy", True, "pct"),
    ("over_correction", "Over-correction (corrected a correct turn)", False, "pct"),
    ("under_correction", "Under-correction (missed a due correction)", False, "pct"),
    ("recast_correctness", "Recast correctness", True, "pct"),
    ("tag_f1_micro", "Error-tag F1 (micro)", True, "num"),
    ("tag_f1_macro", "Error-tag F1 (macro)", True, "num"),
    ("annotation_consistency", "Annotation consistency", True, "pct"),
)


@dataclass(frozen=True)
class BenchRow:
    model: str
    device: str
    test: str
    tokens_per_second: float
    threads: int


def parse_llama_bench(payload: str, device: str) -> list[BenchRow]:
    """Rows from `llama-bench -o json` output (prompt processing and generation tests)."""
    rows = json.loads(payload)
    out: list[BenchRow] = []
    for r in rows:
        n_prompt, n_gen = int(r.get("n_prompt", 0)), int(r.get("n_gen", 0))
        test = f"pp{n_prompt}" if n_prompt and not n_gen else f"tg{n_gen}"
        if n_prompt and n_gen:
            test = f"pp{n_prompt}+tg{n_gen}"
        out.append(
            BenchRow(
                model=str(r.get("model_filename", r.get("model_type", "?"))).rsplit("/", 1)[-1],
                device=device,
                test=test,
                tokens_per_second=float(r.get("avg_ts", 0.0)),
                threads=int(r.get("n_threads", 0)),
            )
        )
    return out


def _fmt(value: float, kind: str) -> str:
    return f"{100 * value:.1f}%" if kind == "pct" else f"{value:.2f}"


def _metrics_section(scores: Sequence[SystemScores]) -> list[str]:
    summaries = {s.system: s.summary() for s in scores}
    lines = [
        "## Automatic metrics",
        "",
        "| Metric | " + " | ".join(summaries) + " |",
        "|---|" + "---|" * len(summaries),
    ]
    for key, label, higher, kind in METRICS:
        values = [summaries[s][key] for s in summaries]
        top = max(values) if higher else min(values)
        cells = [
            f"**{_fmt(v, kind)}**" if len(values) > 1 and v == top else _fmt(v, kind)
            for v in values
        ]
        arrow = "higher" if higher else "lower"
        lines.append(f"| {label} ({arrow} is better) | " + " | ".join(cells) + " |")
    return [*lines, ""]


def _ratio(numerator: int, denominator: int) -> str:
    return _fmt(numerator / denominator if denominator else 0.0, "pct")


def _level_section(scores: Sequence[SystemScores]) -> list[str]:
    lines = [
        "## By level",
        "",
        "| System | Level | Items | JSON valid | Move accuracy | Tokens outside band |",
        "|---|---|---|---|---|---|",
    ]
    for s in scores:
        for level in sorted(s.by_level):
            c = s.by_level[level]
            lines.append(
                f"| {s.system} | {level} | {c['items']} | {_ratio(c['json_valid'], c['items'])} | "
                f"{_ratio(c['move_correct'], c['json_valid'])} | "
                f"{_ratio(c['out_of_band_tokens'], c['content_tokens'])} |"
            )
    return [*lines, ""]


def _moves_section(scores: Sequence[SystemScores]) -> list[str]:
    lines = ["## Feedback moves (rows: gold, columns: predicted)", ""]
    predicted = [*MOVES, "invalid"]
    for s in scores:
        lines += [
            f"**{s.system}**",
            "",
            "| gold \\ predicted | " + " | ".join(predicted) + " |",
            "|---|" + "---|" * len(predicted),
        ]
        for gold in MOVES:
            row = [str(s.move_confusion.get((gold, p), 0)) for p in predicted]
            lines.append(f"| {gold} | " + " | ".join(row) + " |")
        lines.append("")
    return lines


def _tags_section(scores: Sequence[SystemScores]) -> list[str]:
    if not scores:
        return []
    best = max(scores, key=lambda s: s.summary()["tag_f1_micro"])
    _, _, per_tag = tag_scores(best.gold_tags, best.predicted_tags)
    lines = [
        "## Error tags (per tag, best system by micro F1)",
        "",
        f"System: {best.system}",
        "",
        "| Tag | Support | Precision | Recall | F1 |",
        "|---|---|---|---|---|",
    ]
    for tag, p in sorted(per_tag.items(), key=lambda kv: -kv[1].support):
        lines.append(f"| {tag} | {p.support} | {p.precision:.2f} | {p.recall:.2f} | {p.f1:.2f} |")
    return [*lines, ""]


def _win_section(win_rates: Sequence[WinRate]) -> list[str]:
    if not win_rates:
        return []
    lines = [
        "## Judge pairwise win rates",
        "",
        "Position-swapped; ties and inconsistent verdicts count 0.5. 95% Wilson interval.",
        "",
        "| System | Opponent | Comparisons | Win rate | 95% CI | Judge failures |",
        "|---|---|---|---|---|---|",
    ]
    for w in win_rates:
        lines.append(
            f"| {w.system} | {w.opponent} | {w.comparisons} | "
            f"{_fmt(w.win_rate, 'pct')} | {_fmt(w.low, 'pct')} to "
            f"{_fmt(w.high, 'pct')} | {w.failed} |"
        )
    return [*lines, ""]


def _bench_section(bench: Sequence[BenchRow]) -> list[str]:
    lines = ["## On-device speed (llama-bench)", ""]
    if not bench:
        return [*lines, "Not measured in this run; see `eval/DEVICE_BENCH.md`.", ""]
    lines += ["| Device | Model | Test | Tokens/s | Threads |", "|---|---|---|---|---|"]
    for b in bench:
        lines.append(
            f"| {b.device} | {b.model} | {b.test} | {b.tokens_per_second:.1f} | {b.threads} |"
        )
    return [*lines, ""]


def render_report(
    title: str,
    scores: Sequence[SystemScores],
    win_rates: Sequence[WinRate] = (),
    bench: Sequence[BenchRow] = (),
    notes: Sequence[str] = (),
) -> str:
    lines = [f"# {title}", ""]
    if scores:
        n = scores[0].items
        lines += [f"Held-out items: {n} tutor turns from evaluation-only scenarios.", ""]
    lines += _metrics_section(scores)
    lines += _level_section(scores)
    lines += _moves_section(scores)
    lines += _tags_section(scores)
    lines += _win_section(win_rates)
    lines += _bench_section(bench)
    if notes:
        lines += ["## Notes", "", *[f"- {n}" for n in notes], ""]
    return "\n".join(lines)


def summary_json(scores: Sequence[SystemScores], win_rates: Sequence[WinRate]) -> dict[str, Any]:
    return {
        "systems": {s.system: s.summary() for s in scores},
        "winRates": [w.__dict__ for w in win_rates],
    }
