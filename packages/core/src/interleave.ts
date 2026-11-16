import type { CardKind } from './types';

/** The tags interleaving looks at. */
export interface Interleavable {
  kind: CardKind;
  grammarIds: readonly number[];
  lemmaIds: readonly number[];
}

/** Options for {@link interleaveItems}. */
export interface InterleaveOptions {
  /**
   * How many of the next items (in priority order) are considered at each
   * step. Larger spreads tags better; smaller keeps closer to priority order.
   * Defaults to 10.
   */
  lookahead?: number;
}

const SAME_LEMMA_PREVIOUS = 8;
const SAME_GRAMMAR_PREVIOUS = 4;
const SAME_KIND_PREVIOUS = 1;
const SAME_LEMMA_TWO_BACK = 2;
const SAME_GRAMMAR_TWO_BACK = 1;

function shares(a: readonly number[], b: readonly number[]): boolean {
  return a.some((id) => b.includes(id));
}

function penalty(item: Interleavable, prev1?: Interleavable, prev2?: Interleavable): number {
  let p = 0;
  if (prev1 !== undefined) {
    if (shares(item.lemmaIds, prev1.lemmaIds)) p += SAME_LEMMA_PREVIOUS;
    if (shares(item.grammarIds, prev1.grammarIds)) p += SAME_GRAMMAR_PREVIOUS;
    if (item.kind === prev1.kind) p += SAME_KIND_PREVIOUS;
  }
  if (prev2 !== undefined) {
    if (shares(item.lemmaIds, prev2.lemmaIds)) p += SAME_LEMMA_TWO_BACK;
    if (shares(item.grammarIds, prev2.grammarIds)) p += SAME_GRAMMAR_TWO_BACK;
  }
  return p;
}

/**
 * How many remaining items share a lemma or grammar point with `item`.
 * Placing crowded groups early avoids leaving a clump at the end.
 */
function crowding(item: Interleavable, remaining: readonly Interleavable[]): number {
  let n = 0;
  for (const other of remaining) {
    if (shares(item.lemmaIds, other.lemmaIds) || shares(item.grammarIds, other.grammarIds)) n++;
  }
  return n;
}

/**
 * Reorder items (given in priority order) so that neighbours do not share a
 * lemma, a grammar point or, less importantly, a card kind. Greedy: at each
 * step it takes, from the next `lookahead` items, the one with the fewest
 * clashes with the last two placed, preferring items from crowded groups and
 * then higher priority. Deterministic; the input is not mutated.
 */
export function interleaveItems<T extends Interleavable>(
  items: readonly T[],
  options: InterleaveOptions = {},
): T[] {
  const lookahead = options.lookahead ?? 10;
  if (!Number.isSafeInteger(lookahead) || lookahead < 1) {
    throw new RangeError('lookahead must be a positive whole number');
  }
  const remaining = [...items];
  const out: T[] = [];
  while (remaining.length > 0) {
    const prev1 = out[out.length - 1];
    const prev2 = out[out.length - 2];
    const window = Math.min(lookahead, remaining.length);
    let bestIndex = 0;
    let bestPenalty = Infinity;
    let bestCrowding = -Infinity;
    for (let i = 0; i < window; i++) {
      const candidate = remaining[i];
      if (candidate === undefined) continue;
      const p = penalty(candidate, prev1, prev2);
      if (p > bestPenalty) continue;
      const c = crowding(candidate, remaining);
      if (p < bestPenalty || c > bestCrowding) {
        bestIndex = i;
        bestPenalty = p;
        bestCrowding = c;
      }
    }
    const [chosen] = remaining.splice(bestIndex, 1);
    if (chosen !== undefined) out.push(chosen);
  }
  return out;
}
