import { and, asc, count, eq, inArray, isNull, sql } from 'drizzle-orm';

import type { Rating } from '@italia/core';

import { reviewLog } from '@/db/schema';
import type { AppDatabase } from '@/db/types';

import type { IdGenerator } from './ids';
import type { ReviewLogRow } from './rows';
import { chunk, MAX_IDS_PER_QUERY } from './util';

/** A review to append. */
export interface AppendReviewInput {
  /** Defaults to a new UUID. */
  id?: string;
  cardId: string;
  rating: Rating;
  answer: string | null;
  latencyMs: number;
  reviewedAt: Date;
  deviceId: string;
}

/** Position in the log's total order `(reviewedAt, id)`, exclusive. */
export interface ReviewLogCursor {
  reviewedAt: Date;
  id: string;
}

/** One page of {@link ReviewLogRepo.listSince}. */
export interface ReviewLogPage {
  rows: ReviewLogRow[];
  /** Cursor after the last row, or null when this page reached the end. */
  nextCursor: ReviewLogCursor | null;
}

/**
 * The append-only review log (ADR 0002). There is deliberately no update or
 * delete: rows are inserted once and only their local `syncedAt` marker may
 * change. A database trigger rejects any other update.
 */
export interface ReviewLogRepo {
  /** Insert one review and return the stored row. */
  append(input: AppendReviewInput): ReviewLogRow;
  /** The review with this id, or null. */
  getById(id: string): ReviewLogRow | null;
  /** All reviews of a card in replay order (`reviewedAt`, then id). */
  listForCard(cardId: string): ReviewLogRow[];
  /**
   * Reviews strictly after `cursor` in `(reviewedAt, id)` order, at most
   * `limit`. Pass null to start from the beginning.
   */
  listSince(cursor: ReviewLogCursor | null, limit: number): ReviewLogPage;
  /** Reviews not yet pushed to the server, oldest first. */
  listUnsynced(limit: number): ReviewLogRow[];
  /**
   * Set the local `syncedAt` marker on these reviews (only on rows not
   * already marked). Returns the number of rows marked.
   */
  markSynced(ids: readonly string[], syncedAt: Date): number;
  /** Number of reviews. */
  count(): number;
}

/** Create a {@link ReviewLogRepo}. */
export function createReviewLogRepo(db: AppDatabase, newId: IdGenerator): ReviewLogRepo {
  return {
    append(input) {
      return db
        .insert(reviewLog)
        .values({
          id: input.id ?? newId(),
          cardId: input.cardId,
          rating: input.rating,
          answer: input.answer,
          latencyMs: input.latencyMs,
          reviewedAt: input.reviewedAt,
          deviceId: input.deviceId,
        })
        .returning()
        .get();
    },
    getById(id) {
      return db.select().from(reviewLog).where(eq(reviewLog.id, id)).get() ?? null;
    },
    listForCard(cardId) {
      return db
        .select()
        .from(reviewLog)
        .where(eq(reviewLog.cardId, cardId))
        .orderBy(asc(reviewLog.reviewedAt), asc(reviewLog.id))
        .all();
    },
    listSince(cursor, limit) {
      const rows = db
        .select()
        .from(reviewLog)
        .where(
          cursor === null
            ? undefined
            : sql`(${reviewLog.reviewedAt}, ${reviewLog.id}) > (${cursor.reviewedAt.getTime()}, ${cursor.id})`,
        )
        .orderBy(asc(reviewLog.reviewedAt), asc(reviewLog.id))
        .limit(limit)
        .all();
      const last = rows.at(-1);
      return {
        rows,
        nextCursor:
          last !== undefined && rows.length === limit
            ? { reviewedAt: last.reviewedAt, id: last.id }
            : null,
      };
    },
    listUnsynced(limit) {
      return db
        .select()
        .from(reviewLog)
        .where(isNull(reviewLog.syncedAt))
        .orderBy(asc(reviewLog.reviewedAt), asc(reviewLog.id))
        .limit(limit)
        .all();
    },
    markSynced(ids, syncedAt) {
      if (ids.length === 0) return 0;
      return db.transaction((tx) => {
        let marked = 0;
        for (const part of chunk([...new Set(ids)], MAX_IDS_PER_QUERY)) {
          marked += tx
            .update(reviewLog)
            .set({ syncedAt })
            .where(and(inArray(reviewLog.id, part), isNull(reviewLog.syncedAt)))
            .returning({ id: reviewLog.id })
            .all().length;
        }
        return marked;
      });
    },
    count() {
      return db.select({ n: count() }).from(reviewLog).get()?.n ?? 0;
    },
  };
}
