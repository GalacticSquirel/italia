"""Text a tutor reply puts in quotation marks: a mention of a form, not a use of it.

Tutors quote the learner's mistake ("Ho «prenduto»?") or a form under discussion ('il lunedì'),
so checks of the tutor's own Italian skip quoted text. Single quotes count only when they open
after a space or the start and close before a space or punctuation, so elisions (l'ho, un'idea)
are not read as quotes.
"""

from __future__ import annotations

import re

_OPEN_SINGLE = "'\u2018"
_CLOSE_SINGLE = "'\u2019"
_OPEN_DOUBLE = '"\u201c\u00ab'
_CLOSE_DOUBLE = '"\u201d\u00bb'
_QUOTED = re.compile(
    rf"(?:(?<=\s)|^)[{_OPEN_SINGLE}](.+?)[{_CLOSE_SINGLE}](?=[\s.,;:!?)]|$)"
    rf"|[{_OPEN_DOUBLE}](.+?)[{_CLOSE_DOUBLE}]"
)


def quoted_spans(text: str) -> list[str]:
    """The quoted passages, without their quotation marks."""
    return [a or b for a, b in _QUOTED.findall(text)]


def quoted_regions(text: str) -> list[tuple[int, int]]:
    """(start, end) offsets of each quoted passage, quotation marks included."""
    return [m.span() for m in _QUOTED.finditer(text)]


def in_quotes(regions: list[tuple[int, int]], start: int, end: int) -> bool:
    """Whether the span [start, end) overlaps a quoted region."""
    return any(start < r_end and r_start < end for r_start, r_end in regions)
