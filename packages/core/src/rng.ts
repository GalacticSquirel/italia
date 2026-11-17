/**
 * A source of uniformly distributed numbers in [0, 1). Inject one wherever
 * randomness is needed so results are reproducible in tests and on replay.
 */
export type Rng = () => number;

/**
 * Create a small, fast, seeded pseudo-random generator (mulberry32).
 *
 * Not cryptographically secure; use only for ordering and sampling.
 *
 * @param seed - any finite number; it is truncated to 32 bits
 */
export function createRng(seed: number): Rng {
  if (!Number.isFinite(seed)) {
    throw new RangeError('seed must be a finite number');
  }
  let state = Math.trunc(seed) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * Return a shuffled copy of `items` (Fisher-Yates). The input is not mutated.
 */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i] as T;
    out[i] = out[j] as T;
    out[j] = a;
  }
  return out;
}
