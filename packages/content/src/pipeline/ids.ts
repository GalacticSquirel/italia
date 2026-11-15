/** 32-bit FNV-1a over UTF-16 code units. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Stable lemma id: a positive 31-bit hash of `lemma|POS`, so ids survive
 * re-ranking and rebuilds and fit a Postgres `integer`. The build fails on a
 * collision rather than renumbering.
 */
export function lemmaId(lemma: string, pos: string): number {
  return fnv1a(`${lemma}|${pos}`) & 0x7fffffff || 1;
}
