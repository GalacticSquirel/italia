import { eq } from 'drizzle-orm';

import { streakState } from '@/db/schema';
import type { AppDatabase } from '@/db/types';

/** The persisted streak. Streak rules live in `@italia/core`; this only stores the result. */
export interface StreakSnapshot {
  currentDays: number;
  longestDays: number;
  /** Last local calendar day with real study, as YYYY-MM-DD, or null. */
  lastStudyDate: string | null;
  freezesAvailable: number;
}

/** The streak before any study. */
export const EMPTY_STREAK: Readonly<StreakSnapshot> = Object.freeze({
  currentDays: 0,
  longestDays: 0,
  lastStudyDate: null,
  freezesAvailable: 0,
});

const STREAK_ROW_ID = 1;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The single-row streak state. */
export interface StreakRepo {
  /** The stored streak, or {@link EMPTY_STREAK} when none has been saved. */
  get(): StreakSnapshot;
  /** When the streak was last saved, or null. */
  getUpdatedAt(): Date | null;
  /**
   * Save the streak.
   *
   * @throws RangeError when a count is negative or not whole, or the date is malformed
   */
  save(streak: StreakSnapshot, now?: Date): void;
}

function assertValid(streak: StreakSnapshot): void {
  for (const n of [streak.currentDays, streak.longestDays, streak.freezesAvailable]) {
    if (!Number.isSafeInteger(n) || n < 0) {
      throw new RangeError('streak counts must be whole numbers at least 0');
    }
  }
  if (streak.lastStudyDate !== null && !DATE_RE.test(streak.lastStudyDate)) {
    throw new RangeError('lastStudyDate must be YYYY-MM-DD');
  }
}

/** Create a {@link StreakRepo}. */
export function createStreakRepo(db: AppDatabase): StreakRepo {
  const row = () => db.select().from(streakState).where(eq(streakState.id, STREAK_ROW_ID)).get();
  return {
    get() {
      const r = row();
      if (!r) return { ...EMPTY_STREAK };
      return {
        currentDays: r.currentDays,
        longestDays: r.longestDays,
        lastStudyDate: r.lastStudyDate,
        freezesAvailable: r.freezesAvailable,
      };
    },
    getUpdatedAt() {
      return row()?.updatedAt ?? null;
    },
    save(streak, now = new Date()) {
      assertValid(streak);
      const values = {
        currentDays: streak.currentDays,
        longestDays: streak.longestDays,
        lastStudyDate: streak.lastStudyDate,
        freezesAvailable: streak.freezesAvailable,
        updatedAt: now,
      };
      db.insert(streakState)
        .values({ id: STREAK_ROW_ID, ...values })
        .onConflictDoUpdate({ target: streakState.id, set: values })
        .run();
    },
  };
}
