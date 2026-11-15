/**
 * Read-only repositories over the seeded content tables. Content is written
 * only by {@link importSeed}.
 */
import { asc, count, eq, inArray, sql } from 'drizzle-orm';

import { grammarPoint, lemma, sentence } from '@/db/schema';
import type { AppDatabase } from '@/db/types';

import type { GrammarPointRow, LemmaRow, SentenceRow } from './rows';
import { chunk, MAX_IDS_PER_QUERY } from './util';

/** Paging window for list queries. */
export interface Page {
  /** Rows to skip. Defaults to 0. */
  offset?: number;
  /** Maximum rows to return. */
  limit: number;
}

/** Lemmas (dictionary words). */
export interface LemmaRepo {
  /** The lemma with this id, or null. */
  getById(id: number): LemmaRow | null;
  /** Lemmas with these ids, in frequency order. Missing ids are skipped. */
  getByIds(ids: readonly number[]): LemmaRow[];
  /** Lemmas matching this headword (all parts of speech), most frequent first. */
  findByLemma(headword: string): LemmaRow[];
  /** Lemmas in frequency order (most frequent first). */
  listByFrequency(page: Page): LemmaRow[];
  /** Number of lemmas. */
  count(): number;
}

/** Create a {@link LemmaRepo}. */
export function createLemmaRepo(db: AppDatabase): LemmaRepo {
  return {
    getById(id) {
      return db.select().from(lemma).where(eq(lemma.id, id)).get() ?? null;
    },
    getByIds(ids) {
      const rows = chunk([...new Set(ids)], MAX_IDS_PER_QUERY).flatMap((part) =>
        db.select().from(lemma).where(inArray(lemma.id, part)).all(),
      );
      return rows.sort((a, b) => a.freqRank - b.freqRank);
    },
    findByLemma(headword) {
      return db
        .select()
        .from(lemma)
        .where(eq(lemma.lemma, headword))
        .orderBy(asc(lemma.freqRank))
        .all();
    },
    listByFrequency({ offset = 0, limit }) {
      return db.select().from(lemma).orderBy(asc(lemma.freqRank)).limit(limit).offset(offset).all();
    },
    count() {
      return db.select({ n: count() }).from(lemma).get()?.n ?? 0;
    },
  };
}

/** Sentence pairs. */
export interface SentenceRepo {
  /** The sentence with this id, or null. */
  getById(id: number): SentenceRow | null;
  /** Sentences with these ids, ordered by id. Missing ids are skipped. */
  getByIds(ids: readonly number[]): SentenceRow[];
  /** Sentences that contain this lemma, ordered by length (shortest first), then id. */
  listForLemma(lemmaId: number, limit: number): SentenceRow[];
  /** Sentences that exercise this grammar point, shortest first, then id. */
  listForGrammarPoint(grammarId: number, limit: number): SentenceRow[];
  /** Number of sentences. */
  count(): number;
}

/** Create a {@link SentenceRepo}. */
export function createSentenceRepo(db: AppDatabase): SentenceRepo {
  return {
    getById(id) {
      return db.select().from(sentence).where(eq(sentence.id, id)).get() ?? null;
    },
    getByIds(ids) {
      const rows = chunk([...new Set(ids)], MAX_IDS_PER_QUERY).flatMap((part) =>
        db.select().from(sentence).where(inArray(sentence.id, part)).all(),
      );
      return rows.sort((a, b) => a.id - b.id);
    },
    listForLemma(lemmaId, limit) {
      return db
        .select()
        .from(sentence)
        .where(
          sql`exists (select 1 from json_each(${sentence.lemmaIds}) where json_each.value = ${lemmaId})`,
        )
        .orderBy(sql`length(${sentence.it})`, asc(sentence.id))
        .limit(limit)
        .all();
    },
    listForGrammarPoint(grammarId, limit) {
      return db
        .select()
        .from(sentence)
        .where(
          sql`exists (select 1 from json_each(${sentence.grammarIds}) where json_each.value = ${grammarId})`,
        )
        .orderBy(sql`length(${sentence.it})`, asc(sentence.id))
        .limit(limit)
        .all();
    },
    count() {
      return db.select({ n: count() }).from(sentence).get()?.n ?? 0;
    },
  };
}

/** Grammar points. */
export interface GrammarRepo {
  /** The grammar point with this id, or null. */
  getById(id: number): GrammarPointRow | null;
  /** All grammar points in acquisition order. */
  listInOrder(): GrammarPointRow[];
  /** Number of grammar points. */
  count(): number;
}

/** Create a {@link GrammarRepo}. */
export function createGrammarRepo(db: AppDatabase): GrammarRepo {
  return {
    getById(id) {
      return db.select().from(grammarPoint).where(eq(grammarPoint.id, id)).get() ?? null;
    },
    listInOrder() {
      return db.select().from(grammarPoint).orderBy(asc(grammarPoint.order)).all();
    },
    count() {
      return db.select({ n: count() }).from(grammarPoint).get()?.n ?? 0;
    },
  };
}
