import { count, eq, isNotNull, sql } from 'drizzle-orm';

import { lemmaExposure, storyProgress } from '@/db/schema';
import type { AppDatabase } from '@/db/types';

import type { StoryProgressRow } from './rows';

/** A finished reading of a story, see {@link ReadingRepo.markRead}. */
export interface StoryReading {
  /** Word tokens read (the story's word count). */
  wordsRead: number;
  /** Lemma occurrences met in the story: lemma id to number of tokens. */
  exposures: ReadonlyMap<number, number>;
  /** Comprehension check result, or null when it was skipped. */
  comprehension: { correct: number; total: number } | null;
}

/** Reading totals for progress. */
export interface ReadingTotals {
  /** Distinct stories finished at least once. */
  storiesRead: number;
  /** Words read across all finished readings. */
  wordsRead: number;
  /** Distinct lemmas met in finished stories. */
  lemmasMet: number;
}

/** The learner's reading progress and the words met in stories. */
export interface ReadingRepo {
  /** Progress on one story, or null if never opened. */
  get(storyId: string): StoryProgressRow | null;
  /** Progress on every story opened. */
  listAll(): StoryProgressRow[];
  /** Ids of the stories finished at least once. */
  readStoryIds(): Set<string>;
  /** Record that a story was opened (keeps the first open time). */
  open(storyId: string, now: Date): StoryProgressRow;
  /** Remember the sentence the learner is on. */
  savePosition(storyId: string, sentenceIndex: number, now: Date): void;
  /**
   * Record a finished reading: marks the story read (keeping the first
   * completion time), adds the words read, stores the comprehension result
   * and adds the lemma exposures, in one transaction.
   */
  markRead(storyId: string, reading: StoryReading, now: Date): StoryProgressRow;
  /** Times the learner has met `lemmaId` in finished stories (0 if never). */
  exposureCount(lemmaId: number): number;
  /** Exposure counts for several lemmas (missing ones are 0). */
  exposureCounts(lemmaIds: readonly number[]): Map<number, number>;
  /** Totals for the progress screen. */
  totals(): ReadingTotals;
}

function assertCount(n: number, name: string): void {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new RangeError(`${name} must be a whole number >= 0`);
}

/** Create a {@link ReadingRepo}. */
export function createReadingRepo(db: AppDatabase): ReadingRepo {
  const get = (storyId: string, tx: AppDatabase = db): StoryProgressRow | null =>
    tx.select().from(storyProgress).where(eq(storyProgress.storyId, storyId)).get() ?? null;

  const ensure = (tx: AppDatabase, storyId: string, now: Date) => {
    tx.insert(storyProgress)
      .values({ storyId, startedAt: now, updatedAt: now })
      .onConflictDoNothing()
      .run();
  };

  return {
    get: (storyId) => get(storyId),
    listAll() {
      return db.select().from(storyProgress).all();
    },
    readStoryIds() {
      const rows = db
        .select({ id: storyProgress.storyId })
        .from(storyProgress)
        .where(isNotNull(storyProgress.completedAt))
        .all();
      return new Set(rows.map((r) => r.id));
    },
    open(storyId, now) {
      ensure(db, storyId, now);
      const row = get(storyId);
      if (!row) throw new Error(`Story progress missing: ${storyId}`);
      return row;
    },
    savePosition(storyId, sentenceIndex, now) {
      assertCount(sentenceIndex, 'sentenceIndex');
      db.transaction((tx) => {
        ensure(tx, storyId, now);
        tx.update(storyProgress)
          .set({ lastSentence: sentenceIndex, updatedAt: now })
          .where(eq(storyProgress.storyId, storyId))
          .run();
      });
    },
    markRead(storyId, reading, now) {
      assertCount(reading.wordsRead, 'wordsRead');
      if (reading.comprehension) {
        assertCount(reading.comprehension.correct, 'comprehension.correct');
        assertCount(reading.comprehension.total, 'comprehension.total');
      }
      for (const n of reading.exposures.values()) assertCount(n, 'exposure count');
      return db.transaction((tx) => {
        ensure(tx, storyId, now);
        tx.update(storyProgress)
          .set({
            completedAt: sql`coalesce(${storyProgress.completedAt}, ${now.getTime()})`,
            timesRead: sql`${storyProgress.timesRead} + 1`,
            wordsRead: sql`${storyProgress.wordsRead} + ${reading.wordsRead}`,
            lastSentence: 0,
            ...(reading.comprehension
              ? {
                  comprehensionCorrect: reading.comprehension.correct,
                  comprehensionTotal: reading.comprehension.total,
                }
              : {}),
            updatedAt: now,
          })
          .where(eq(storyProgress.storyId, storyId))
          .run();
        for (const [lemmaId, n] of reading.exposures) {
          if (n === 0) continue;
          tx.insert(lemmaExposure)
            .values({ lemmaId, count: n, firstSeenAt: now, lastSeenAt: now })
            .onConflictDoUpdate({
              target: lemmaExposure.lemmaId,
              set: { count: sql`${lemmaExposure.count} + ${n}`, lastSeenAt: now },
            })
            .run();
        }
        const row = get(storyId, tx);
        if (!row) throw new Error(`Story progress missing: ${storyId}`);
        return row;
      });
    },
    exposureCount(lemmaId) {
      return (
        db
          .select({ count: lemmaExposure.count })
          .from(lemmaExposure)
          .where(eq(lemmaExposure.lemmaId, lemmaId))
          .get()?.count ?? 0
      );
    },
    exposureCounts(lemmaIds) {
      const wanted = new Set(lemmaIds);
      const out = new Map<number, number>();
      for (const id of wanted) out.set(id, 0);
      if (wanted.size === 0) return out;
      for (const row of db.select().from(lemmaExposure).all()) {
        if (wanted.has(row.lemmaId)) out.set(row.lemmaId, row.count);
      }
      return out;
    },
    totals() {
      const stories = db
        .select({
          n: count(storyProgress.completedAt),
          words: sql<number>`coalesce(sum(${storyProgress.wordsRead}), 0)`,
        })
        .from(storyProgress)
        .get();
      const lemmas = db.select({ n: count() }).from(lemmaExposure).get();
      return {
        storiesRead: stories?.n ?? 0,
        wordsRead: stories?.words ?? 0,
        lemmasMet: lemmas?.n ?? 0,
      };
    },
  };
}
