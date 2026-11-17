/**
 * 32-bit FNV-1a over a string's UTF-16 code units, as an unsigned integer.
 *
 * Stable across platforms and releases: lemma ids, learner-sentence ids and
 * other persisted identifiers are derived from it, so the algorithm must
 * never change. Not cryptographic; use it for ids, cache keys and seeds.
 */
export function fnv1a32(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** {@link fnv1a32} as 8 lower-case hex digits. */
export function fnv1a32Hex(text: string): string {
  return fnv1a32(text).toString(16).padStart(8, '0');
}
