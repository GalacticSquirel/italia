import { fnv1a32 } from '@italia/core';

/**
 * Stable lemma id: a positive 31-bit hash of `lemma|POS`, so ids survive
 * re-ranking and rebuilds and fit a Postgres `integer`. The build fails on a
 * collision rather than renumbering.
 */
export function lemmaId(lemma: string, pos: string): number {
  return fnv1a32(`${lemma}|${pos}`) & 0x7fffffff || 1;
}
