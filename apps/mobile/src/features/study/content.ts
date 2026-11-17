import { GRAMMAR_DRILLS, GRAMMAR_POINTS, type GrammarDrill } from '@italia/content';

import type {
  GrammarPointRow,
  LearnerSentenceRow,
  LemmaRow,
  Repositories,
  SentenceRow,
} from '@/data';

/**
 * In-memory index of the seeded content (lemmas, sentences, grammar points).
 * Content only changes on a seed import, which finishes before any screen
 * renders, so one index per repositories instance is built lazily and reused.
 */
export interface ContentIndex {
  /** Lemmas in frequency order. */
  lemmas: readonly LemmaRow[];
  lemmaById: ReadonlyMap<number, LemmaRow>;
  sentenceById: ReadonlyMap<number, SentenceRow>;
  /**
   * Sentences containing each lemma, easiest first: fewest words without a
   * lemma (names), then by difficulty (the rarest word's frequency rank, so
   * sentences made only of common words come first), then by length.
   */
  sentencesByLemma: ReadonlyMap<number, readonly SentenceRow[]>;
  /** Sentences, shortest first, then by id. */
  sentencesByLength: readonly SentenceRow[];
  /** Grammar points in acquisition order. */
  grammar: readonly GrammarPointRow[];
  grammarById: ReadonlyMap<number, GrammarPointRow>;
  /**
   * Hand-written drills for each grammar point (in drill order), only for
   * points in the seed. They target exactly the point being taught, so they
   * are how a point is first practised and unlocked.
   */
  drillsByPoint: ReadonlyMap<number, readonly GrammarDrill[]>;
  drillById: ReadonlyMap<number, GrammarDrill>;
  /**
   * Sentences the learner corrected in conversation (negative ids), practised
   * only as `sentence_production` cards. They are not in the other indexes, so
   * they are never used as example or cloze material.
   */
  learnerSentenceById: ReadonlyMap<number, LearnerSentenceRow>;
}

const cache = new WeakMap<object, ContentIndex>();

const SYLLABUS_TITLES = new Map(GRAMMAR_POINTS.map((p) => [p.id, p.title]));

/** Build a {@link ContentIndex} from content rows. */
export function buildContentIndex(
  lemmas: readonly LemmaRow[],
  sentences: readonly SentenceRow[],
  grammar: readonly GrammarPointRow[],
  learnerSentences: readonly LearnerSentenceRow[] = [],
  drills: readonly GrammarDrill[] = GRAMMAR_DRILLS,
): ContentIndex {
  const byLength = [...sentences].sort((a, b) => a.it.length - b.it.length || a.id - b.id);
  const rank = new Map(lemmas.map((l) => [l.id, l.freqRank]));
  const difficulty = new Map(
    sentences.map((s) => [
      s.id,
      s.lemmaIds.reduce((max, id) => Math.max(max, rank.get(id) ?? Infinity), 0),
    ]),
  );
  // Words without a lemma: names, and the odd word the content tagger missed.
  const unknown = (s: SentenceRow) => s.tokens?.filter((t) => t.length === 2).length ?? 0;
  const easiest = [...byLength].sort(
    (a, b) => unknown(a) - unknown(b) || (difficulty.get(a.id) ?? 0) - (difficulty.get(b.id) ?? 0),
  );
  const byLemma = new Map<number, SentenceRow[]>();
  for (const s of easiest) {
    for (const id of new Set(s.lemmaIds)) {
      const list = byLemma.get(id);
      if (list) list.push(s);
      else byLemma.set(id, [s]);
    }
  }
  const sortedLemmas = [...lemmas].sort((a, b) => a.freqRank - b.freqRank);
  const sortedGrammar = [...grammar].sort((a, b) => a.order - b.order);
  // A drill belongs to the syllabus point with its id. Attach it only when the
  // seeded point is that point (same title), so a different or older content
  // seed never shows drills for the wrong grammar.
  const titleById = new Map(grammar.map((g) => [g.id, g.title]));
  const seededDrills = drills.filter(
    (d) => titleById.get(d.pointId) === SYLLABUS_TITLES.get(d.pointId),
  );
  const drillsByPoint = new Map<number, GrammarDrill[]>();
  for (const d of seededDrills) {
    const list = drillsByPoint.get(d.pointId);
    if (list) list.push(d);
    else drillsByPoint.set(d.pointId, [d]);
  }
  return {
    lemmas: sortedLemmas,
    lemmaById: new Map(sortedLemmas.map((l) => [l.id, l])),
    sentenceById: new Map(sentences.map((s) => [s.id, s])),
    sentencesByLemma: byLemma,
    sentencesByLength: byLength,
    grammar: sortedGrammar,
    grammarById: new Map(sortedGrammar.map((g) => [g.id, g])),
    drillsByPoint,
    drillById: new Map(seededDrills.map((d) => [d.id, d])),
    learnerSentenceById: new Map(learnerSentences.map((s) => [s.id, s])),
  };
}

/** The content index for these repositories, built on first use. */
export function getContentIndex(repos: Repositories): ContentIndex {
  const cached = cache.get(repos);
  if (cached) return cached;
  const index = buildContentIndex(
    repos.lemmas.listByFrequency({ limit: Math.max(1, repos.lemmas.count()) }),
    repos.sentences.listAll(),
    repos.grammar.listInOrder(),
    repos.learnerSentences.listAll(),
  );
  cache.set(repos, index);
  return index;
}

/** Drop the cached index, after learner sentences were added. */
export function invalidateContentIndex(repos: Repositories): void {
  cache.delete(repos);
}

/**
 * The grammar point a sentence mainly practises: the most advanced (highest
 * acquisition order) of its grammar points, or null when it has none.
 */
export function grammarFocus(sentence: SentenceRow, content: ContentIndex): number | null {
  let best: GrammarPointRow | null = null;
  for (const id of sentence.grammarIds) {
    const g = content.grammarById.get(id);
    if (g && (best === null || g.order > best.order)) best = g;
  }
  return best?.id ?? null;
}
