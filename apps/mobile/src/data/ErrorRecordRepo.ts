import { count, desc, eq } from 'drizzle-orm';

import { type ERROR_SOURCES, errorRecord } from '@/db/schema';
import type { AppDatabase } from '@/db/types';

import type { IdGenerator } from './ids';
import type { ErrorRecordRow } from './rows';

/** Where an error was observed. */
export type ErrorSource = (typeof ERROR_SOURCES)[number];

/** An error to record. */
export interface AddErrorInput {
  /** Error taxonomy key, e.g. "agreement.gender". */
  category: string;
  example: string;
  source: ErrorSource;
  /** Card that practises the fix, if any. */
  cardId?: string | null;
  /** Defaults to now. */
  createdAt?: Date;
}

/** Learner errors from conversations and reviews. */
export interface ErrorRecordRepo {
  /** Record an error and return the stored row. */
  add(input: AddErrorInput): ErrorRecordRow;
  /** Most recent errors first, at most `limit`. */
  listRecent(limit: number): ErrorRecordRow[];
  /** Errors in one category, most recent first. */
  listByCategory(category: string, limit: number): ErrorRecordRow[];
  /** Error counts per category, most frequent first. */
  countByCategory(): { category: string; count: number }[];
}

/** Create an {@link ErrorRecordRepo}. */
export function createErrorRecordRepo(db: AppDatabase, newId: IdGenerator): ErrorRecordRepo {
  return {
    add(input) {
      return db
        .insert(errorRecord)
        .values({
          id: newId(),
          category: input.category,
          example: input.example,
          source: input.source,
          cardId: input.cardId ?? null,
          createdAt: input.createdAt ?? new Date(),
        })
        .returning()
        .get();
    },
    listRecent(limit) {
      return db
        .select()
        .from(errorRecord)
        .orderBy(desc(errorRecord.createdAt), desc(errorRecord.id))
        .limit(limit)
        .all();
    },
    listByCategory(category, limit) {
      return db
        .select()
        .from(errorRecord)
        .where(eq(errorRecord.category, category))
        .orderBy(desc(errorRecord.createdAt), desc(errorRecord.id))
        .limit(limit)
        .all();
    },
    countByCategory() {
      const n = count();
      return db
        .select({ category: errorRecord.category, count: n })
        .from(errorRecord)
        .groupBy(errorRecord.category)
        .orderBy(desc(n), errorRecord.category)
        .all();
    },
  };
}
