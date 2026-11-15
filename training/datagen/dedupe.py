"""Exact and near-duplicate removal (MinHash with banded locality-sensitive hashing).

Synthetic dialogues from the same scenario tend to converge on the same lines; near-duplicates
waste training tokens and overweight those lines. Two dialogues are near-duplicates when the
estimated Jaccard similarity of their word 5-gram shingles is at least `threshold`.
"""

from __future__ import annotations

import hashlib
from collections.abc import Sequence
from dataclasses import dataclass
from functools import cached_property

from datagen.lemmas import tokenize

_MERSENNE = (1 << 61) - 1


def shingles(text: str, n: int = 5) -> set[str]:
    words = [w.lower() for w in tokenize(text)]
    if len(words) < n:
        return {" ".join(words)} if words else set()
    return {" ".join(words[i : i + n]) for i in range(len(words) - n + 1)}


def _hash(value: str) -> int:
    return int.from_bytes(hashlib.blake2b(value.encode(), digest_size=8).digest(), "big")


@dataclass(frozen=True)
class MinHasher:
    num_perm: int = 64
    seed: int = 1

    @cached_property
    def _params(self) -> list[tuple[int, int]]:
        out: list[tuple[int, int]] = []
        for i in range(self.num_perm):
            a = _hash(f"a{self.seed}:{i}") % (_MERSENNE - 1) + 1
            b = _hash(f"b{self.seed}:{i}") % _MERSENNE
            out.append((a, b))
        return out

    def signature(self, items: set[str]) -> tuple[int, ...]:
        params = self._params
        if not items:
            return tuple([_MERSENNE] * self.num_perm)
        hashes = [_hash(x) for x in items]
        return tuple(min((a * h + b) % _MERSENNE for h in hashes) for a, b in params)


def estimated_jaccard(a: Sequence[int], b: Sequence[int]) -> float:
    return sum(x == y for x, y in zip(a, b, strict=True)) / len(a)


def find_duplicates(
    texts: dict[str, str],
    *,
    threshold: float = 0.8,
    num_perm: int = 64,
    bands: int = 16,
) -> set[str]:
    """Ids to drop: exact duplicates and near-duplicates (the first seen id is kept)."""
    if num_perm % bands:
        raise ValueError("num_perm must be divisible by bands")
    rows = num_perm // bands
    hasher = MinHasher(num_perm=num_perm)
    drop: set[str] = set()
    seen_exact: dict[str, str] = {}
    buckets: dict[tuple[int, bytes], list[str]] = {}
    signatures: dict[str, tuple[int, ...]] = {}
    for doc_id, text in texts.items():
        exact = hashlib.sha256(" ".join(text.lower().split()).encode()).hexdigest()
        if exact in seen_exact:
            drop.add(doc_id)
            continue
        seen_exact[exact] = doc_id
        sig = hasher.signature(shingles(text))
        candidates: set[str] = set()
        keys: list[tuple[int, bytes]] = []
        for band in range(bands):
            chunk = sig[band * rows : (band + 1) * rows]
            key = (band, hashlib.blake2b(repr(chunk).encode(), digest_size=8).digest())
            keys.append(key)
            candidates.update(buckets.get(key, ()))
        if any(estimated_jaccard(sig, signatures[c]) >= threshold for c in candidates):
            drop.add(doc_id)
            continue
        signatures[doc_id] = sig
        for key in keys:
            buckets.setdefault(key, []).append(doc_id)
    return drop
