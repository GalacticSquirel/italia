/**
 * Choose example sentences per lemma.
 *
 * A sentence's difficulty is the highest frequency rank among its lemmas, and its
 * target is that rarest lemma, so a learner who knows every more frequent lemma
 * meets exactly one new word (n+1). Each lemma gets up to `perLemma` such anchor
 * sentences. The most frequent lemmas can never be the rarest word of a sentence,
 * so lemmas with no anchor get a couple of the easiest sentences that contain them.
 */

export interface Candidate {
  readonly id: number;
  /** Normalised Italian text used to drop near-duplicates. */
  readonly norm: string;
  /**
   * Normalised English translation. Tatoeba often has one Italian sentence per
   * person or gender with the same English ("Che mi ha fatto?", "Che mi hai
   * fatto?", "Che mi avete fatto?"); a sentence whose English is already taken
   * is used only when nothing else fills the slot.
   */
  readonly enNorm?: string;
  /** Distinct lemma ids. */
  readonly lemmaIds: readonly number[];
  /** Highest rank among the lemmas. */
  readonly difficulty: number;
  /** Lemma with that rank. */
  readonly rarestLemmaId: number;
  /** Surface form of each lemma in the sentence (first occurrence). */
  readonly formOf: ReadonlyMap<number, string>;
  /** Higher is better. */
  readonly score: number;
}

export interface Selection {
  readonly targetLemmaId: number;
  readonly anchor: boolean;
}

export interface SelectOptions {
  /** Maximum anchor sentences per lemma. */
  readonly perLemma: number;
  /** Sentences given to a lemma that has no anchor. */
  readonly fallbackPerLemma: number;
  /** Maximum sentences that may use the same surface form of the target. */
  readonly perForm: number;
}

const byQuality = (a: Candidate, b: Candidate) => b.score - a.score || a.id - b.id;
const byEase = (a: Candidate, b: Candidate) =>
  a.difficulty - b.difficulty || b.score - a.score || a.id - b.id;

interface Taken {
  readonly norms: Set<string>;
  readonly english: Set<string>;
}

function pick(
  pool: readonly Candidate[],
  lemmaId: number,
  limit: number,
  perForm: number,
  taken: Taken,
): Candidate[] {
  const chosen: Candidate[] = [];
  const norms = new Set<string>();
  const english = new Set<string>();
  const formUse = new Map<string, number>();
  const isNew = (c: Candidate) => !taken.norms.has(c.norm) && !norms.has(c.norm);
  const newEnglish = (c: Candidate) =>
    c.enNorm === undefined || (!taken.english.has(c.enNorm) && !english.has(c.enNorm));
  const take = (c: Candidate) => {
    chosen.push(c);
    norms.add(c.norm);
    if (c.enNorm !== undefined) english.add(c.enNorm);
  };
  for (const c of pool) {
    if (chosen.length >= limit) break;
    if (!isNew(c) || !newEnglish(c)) continue;
    const form = c.formOf.get(lemmaId) ?? '';
    const used = formUse.get(form) ?? 0;
    if (used >= perForm) continue;
    take(c);
    formUse.set(form, used + 1);
  }
  // If the per-form cap left room, fill it with the best remaining sentences,
  // then, as a last resort, with ones that repeat an English translation.
  for (const allowSameEnglish of [false, true]) {
    for (const c of pool) {
      if (chosen.length >= limit) break;
      if (!isNew(c) || chosen.includes(c)) continue;
      if (!allowSameEnglish && !newEnglish(c)) continue;
      take(c);
    }
  }
  return chosen;
}

/** Returns the chosen sentences keyed by sentence id. */
export function selectSentences(
  candidates: readonly Candidate[],
  lemmaIdsByRank: readonly number[],
  options: SelectOptions,
): Map<number, Selection> {
  const anchorsByLemma = new Map<number, Candidate[]>();
  const containing = new Map<number, Candidate[]>();
  for (const c of candidates) {
    let list = anchorsByLemma.get(c.rarestLemmaId);
    if (!list) anchorsByLemma.set(c.rarestLemmaId, (list = []));
    list.push(c);
    for (const l of c.lemmaIds) {
      let all = containing.get(l);
      if (!all) containing.set(l, (all = []));
      all.push(c);
    }
  }
  const selected = new Map<number, Selection>();
  const taken: Taken = { norms: new Set(), english: new Set() };
  const markTaken = (c: Candidate) => {
    taken.norms.add(c.norm);
    if (c.enNorm !== undefined) taken.english.add(c.enNorm);
  };
  for (const lemmaId of lemmaIdsByRank) {
    const pool = (anchorsByLemma.get(lemmaId) ?? []).slice().sort(byQuality);
    for (const c of pick(pool, lemmaId, options.perLemma, options.perForm, taken)) {
      selected.set(c.id, { targetLemmaId: lemmaId, anchor: true });
      markTaken(c);
    }
  }
  const covered = new Set([...selected.values()].map((s) => s.targetLemmaId));
  for (const lemmaId of lemmaIdsByRank) {
    if (covered.has(lemmaId)) continue;
    const pool = (containing.get(lemmaId) ?? []).slice().sort(byEase);
    for (const c of pick(pool, lemmaId, options.fallbackPerLemma, options.perForm, taken)) {
      selected.set(c.id, { targetLemmaId: lemmaId, anchor: false });
      markTaken(c);
    }
  }
  return selected;
}
