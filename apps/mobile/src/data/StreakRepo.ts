import { eq } from 'drizzle-orm';

import type { StreakState } from '@italia/core';

import { streakState } from '@/db/schema';
import type { AppDatabase } from '@/db/types';

/**
 * The persisted streak: exactly `StreakState` from `@italia/core`, whose
 * streak rules produce it. This repository only stores the result.
 */
export type StreakSnapshot = StreakState;

/** The streak before any study. */
export const EMPTY_STREAK: Readonly<StreakSnapshot> = Object.freeze({
  currentDays: 0,
  longestDays: 0,
  lastStudyDate: null,
  freezesAvailable: 0,
  day: null,
  repair: null,
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
   * @throws RangeError when a count is negative or not whole, or a date is malformed
   */
  save(streak: StreakSnapshot, now?: Date): void;
}

function assertCount(n: number): void {
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new RangeError('streak counts must be whole numbers at least 0');
  }
}

function assertDate(date: string, name: string): void {
  if (!DATE_RE.test(date)) throw new RangeError(`${name} must be YYYY-MM-DD`);
}

function assertValid(streak: StreakSnapshot): void {
  for (const n of [streak.currentDays, streak.longestDays, streak.freezesAvailable]) {
    assertCount(n);
  }
  if (streak.lastStudyDate !== null) assertDate(streak.lastStudyDate, 'lastStudyDate');
  if (streak.day !== null) {
    assertDate(streak.day.date, 'day.date');
    assertCount(streak.day.completedSessions);
    if (!Number.isFinite(streak.day.activeMinutes) || streak.day.activeMinutes < 0) {
      throw new RangeError('day.activeMinutes must be a finite number at least 0');
    }
  }
  if (streak.repair !== null) {
    assertDate(streak.repair.missedDate, 'repair.missedDate');
    assertCount(streak.repair.lostDays);
    assertCount(streak.repair.freezesNeeded);
  }
}

type StreakColumns = Omit<typeof streakState.$inferInsert, 'id' | 'updatedAt'>;

/** The streak as table columns (nested objects flattened). */
export function streakToColumns(streak: StreakSnapshot): StreakColumns {
  return {
    currentDays: streak.currentDays,
    longestDays: streak.longestDays,
    lastStudyDate: streak.lastStudyDate,
    freezesAvailable: streak.freezesAvailable,
    dayDate: streak.day?.date ?? null,
    dayActiveMinutes: streak.day?.activeMinutes ?? null,
    dayCompletedSessions: streak.day?.completedSessions ?? null,
    repairMissedDate: streak.repair?.missedDate ?? null,
    repairLostDays: streak.repair?.lostDays ?? null,
    repairFreezesNeeded: streak.repair?.freezesNeeded ?? null,
  };
}

/** A streak row (or backup entry) as a {@link StreakSnapshot}. */
export function streakFromColumns(r: StreakColumns): StreakSnapshot {
  return {
    currentDays: r.currentDays ?? 0,
    longestDays: r.longestDays ?? 0,
    lastStudyDate: r.lastStudyDate ?? null,
    freezesAvailable: r.freezesAvailable ?? 0,
    day:
      r.dayDate === null || r.dayDate === undefined
        ? null
        : {
            date: r.dayDate,
            activeMinutes: r.dayActiveMinutes ?? 0,
            completedSessions: r.dayCompletedSessions ?? 0,
          },
    repair:
      r.repairMissedDate === null || r.repairMissedDate === undefined
        ? null
        : {
            missedDate: r.repairMissedDate,
            lostDays: r.repairLostDays ?? 0,
            freezesNeeded: r.repairFreezesNeeded ?? 0,
          },
  };
}

/** Create a {@link StreakRepo}. */
export function createStreakRepo(db: AppDatabase): StreakRepo {
  const row = () => db.select().from(streakState).where(eq(streakState.id, STREAK_ROW_ID)).get();
  return {
    get() {
      const r = row();
      if (!r) return { ...EMPTY_STREAK };
      return streakFromColumns(r);
    },
    getUpdatedAt() {
      return row()?.updatedAt ?? null;
    },
    save(streak, now = new Date()) {
      assertValid(streak);
      const values = { ...streakToColumns(streak), updatedAt: now };
      db.insert(streakState)
        .values({ id: STREAK_ROW_ID, ...values })
        .onConflictDoUpdate({ target: streakState.id, set: values })
        .run();
    },
  };
}
