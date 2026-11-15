import { desc, eq, inArray } from 'drizzle-orm';

import { learnerSentence } from '@/db/schema';
import type { AppDatabase } from '@/db/types';

import type { ErrorSource } from './ErrorRecordRepo';
import type { LearnerSentenceRow } from './rows';
import { chunk, MAX_IDS_PER_QUERY } from './util';

/** A corrected sentence to keep for practice. */
export interface AddLearnerSentenceInput {
  /** The corrected sentence (the answer). */
  it: string;
  /** What the learner wrote (the prompt). */
  original: string;
  errorTags: readonly string[];
  grammarIds: readonly number[];
  source: ErrorSource;
  createdAt?: Date;
}

/** Sentences corrected in conversation, practised as `sentence_production` cards. */
export interface LearnerSentenceRepo {
  /**
   * Store a corrected sentence and return its row. Adding the same corrected
   * sentence again returns the existing row unchanged.
   */
  add(input: AddLearnerSentenceInput): LearnerSentenceRow;
  getById(id: number): LearnerSentenceRow | null;
  /** Rows with these ids (any order). */
  getByIds(ids: readonly number[]): LearnerSentenceRow[];
  /** Every row, newest first. */
  listAll(): LearnerSentenceRow[];
}

const normalise = (text: string) => text.trim().replace(/\s+/gu, ' ');

/** 32-bit FNV-1a hash of a string's UTF-16 code units. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * The id of a corrected sentence: negative (content ids are positive) and
 * derived from the text, so two devices give the same sentence the same id
 * and its card the same card id. `attempt` > 0 resolves the rare collision.
 */
export function learnerSentenceId(text: string, attempt = 0): number {
  const key = attempt === 0 ? normalise(text) : `${normalise(text)}#${String(attempt)}`;
  return -(fnv1a(key) % 0x7fffffff) - 1;
}

/** Create a {@link LearnerSentenceRepo}. */
export function createLearnerSentenceRepo(db: AppDatabase): LearnerSentenceRepo {
  const getById = (id: number): LearnerSentenceRow | null =>
    db.select().from(learnerSentence).where(eq(learnerSentence.id, id)).get() ?? null;
  return {
    add(input) {
      const it = normalise(input.it);
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const id = learnerSentenceId(it, attempt);
        const existing = getById(id);
        if (existing) {
          if (existing.it === it) return existing;
          continue;
        }
        return db
          .insert(learnerSentence)
          .values({
            id,
            it,
            original: normalise(input.original),
            errorTags: [...input.errorTags],
            grammarIds: [...input.grammarIds],
            source: input.source,
            createdAt: input.createdAt ?? new Date(),
          })
          .returning()
          .get();
      }
      throw new Error('Could not find a free id for the sentence.');
    },
    getById,
    getByIds(ids) {
      const out: LearnerSentenceRow[] = [];
      for (const part of chunk(ids, MAX_IDS_PER_QUERY)) {
        out.push(
          ...db.select().from(learnerSentence).where(inArray(learnerSentence.id, part)).all(),
        );
      }
      return out;
    },
    listAll() {
      return db
        .select()
        .from(learnerSentence)
        .orderBy(desc(learnerSentence.createdAt), desc(learnerSentence.id))
        .all();
    },
  };
}
