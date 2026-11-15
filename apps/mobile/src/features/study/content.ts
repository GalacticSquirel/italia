import type { GrammarPointRow, LemmaRow, Repositories, SentenceRow } from '@/data';

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
  /** Sentences containing each lemma, shortest first. */
  sentencesByLemma: ReadonlyMap<number, readonly SentenceRow[]>;
  /** Sentences, shortest first, then by id. */
  sentencesByLength: readonly SentenceRow[];
  /** Grammar points in acquisition order. */
  grammar: readonly GrammarPointRow[];
  grammarById: ReadonlyMap<number, GrammarPointRow>;
}

const cache = new WeakMap<object, ContentIndex>();

/** Build a {@link ContentIndex} from content rows. */
export function buildContentIndex(
  lemmas: readonly LemmaRow[],
  sentences: readonly SentenceRow[],
  grammar: readonly GrammarPointRow[],
): ContentIndex {
  const byLength = [...sentences].sort((a, b) => a.it.length - b.it.length || a.id - b.id);
  const byLemma = new Map<number, SentenceRow[]>();
  for (const s of byLength) {
    for (const id of new Set(s.lemmaIds)) {
      const list = byLemma.get(id);
      if (list) list.push(s);
      else byLemma.set(id, [s]);
    }
  }
  const sortedLemmas = [...lemmas].sort((a, b) => a.freqRank - b.freqRank);
  const sortedGrammar = [...grammar].sort((a, b) => a.order - b.order);
  return {
    lemmas: sortedLemmas,
    lemmaById: new Map(sortedLemmas.map((l) => [l.id, l])),
    sentenceById: new Map(sentences.map((s) => [s.id, s])),
    sentencesByLemma: byLemma,
    sentencesByLength: byLength,
    grammar: sortedGrammar,
    grammarById: new Map(sortedGrammar.map((g) => [g.id, g])),
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
  );
  cache.set(repos, index);
  return index;
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
