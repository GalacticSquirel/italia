import { and, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import type { SQLiteUpdateSetSource } from 'drizzle-orm/sqlite-core';

import { studySession } from '@/db/schema';
import type { AppDatabase } from '@/db/types';

import type { IdGenerator } from './ids';
import type { StudySessionRow } from './rows';

/** Thrown when a study session id does not exist or has already ended. */
export class StudySessionNotActiveError extends Error {
  constructor(readonly sessionId: string) {
    super(`Study session is not active: ${sessionId}`);
    this.name = 'StudySessionNotActiveError';
  }
}

/** Study sessions and active study time. */
export interface StudySessionRepo {
  /** Start a session at `now` and return it. */
  start(now: Date): StudySessionRow;
  /**
   * Add `activeMinutes` (time actually spent studying since the last
   * heartbeat, at least 0) to an active session.
   *
   * @throws StudySessionNotActiveError when the session is missing or ended
   */
  heartbeat(id: string, activeMinutes: number): void;
  /**
   * Append a completed activity kind to an active session.
   *
   * @throws StudySessionNotActiveError when the session is missing or ended
   */
  addActivity(id: string, activity: string): void;
  /**
   * End a session at `now`, optionally adding final active minutes.
   *
   * @throws StudySessionNotActiveError when the session is missing or ended
   */
  end(id: string, now: Date, finalActiveMinutes?: number): StudySessionRow;
  /** The most recently started session that has not ended, or null. */
  getActive(): StudySessionRow | null;
  /** The session with this id, or null. */
  getById(id: string): StudySessionRow | null;
  /** Sessions started in `[from, to)`, newest first. */
  listBetween(from: Date, to: Date): StudySessionRow[];
  /** Total active minutes of sessions started in `[from, to)`, or of all sessions. */
  totalActiveMinutes(range?: { from: Date; to: Date }): number;
}

function assertMinutes(minutes: number): void {
  if (!Number.isFinite(minutes) || minutes < 0) {
    throw new RangeError('active minutes must be a finite number at least 0');
  }
}

/** Create a {@link StudySessionRepo}. */
export function createStudySessionRepo(db: AppDatabase, newId: IdGenerator): StudySessionRepo {
  const active = (id: string) => and(eq(studySession.id, id), isNull(studySession.endedAt));

  const updateActive = (
    id: string,
    set: SQLiteUpdateSetSource<typeof studySession>,
  ): StudySessionRow => {
    const [row] = db.update(studySession).set(set).where(active(id)).returning().all();
    if (!row) throw new StudySessionNotActiveError(id);
    return row;
  };

  return {
    start(now) {
      return db
        .insert(studySession)
        .values({ id: newId(), startedAt: now, minutesActive: 0, activities: [] })
        .returning()
        .get();
    },
    heartbeat(id, activeMinutes) {
      assertMinutes(activeMinutes);
      updateActive(id, {
        minutesActive: sql`${studySession.minutesActive} + ${activeMinutes}`,
      });
    },
    addActivity(id, activity) {
      updateActive(id, {
        activities: sql`json_insert(${studySession.activities}, '$[#]', ${activity})`,
      });
    },
    end(id, now, finalActiveMinutes = 0) {
      assertMinutes(finalActiveMinutes);
      return updateActive(id, {
        endedAt: now,
        minutesActive: sql`${studySession.minutesActive} + ${finalActiveMinutes}`,
      });
    },
    getActive() {
      return (
        db
          .select()
          .from(studySession)
          .where(isNull(studySession.endedAt))
          .orderBy(desc(studySession.startedAt))
          .limit(1)
          .get() ?? null
      );
    },
    getById(id) {
      return db.select().from(studySession).where(eq(studySession.id, id)).get() ?? null;
    },
    listBetween(from, to) {
      return db
        .select()
        .from(studySession)
        .where(and(gte(studySession.startedAt, from), lt(studySession.startedAt, to)))
        .orderBy(desc(studySession.startedAt))
        .all();
    },
    totalActiveMinutes(range) {
      const row = db
        .select({ total: sql<number>`coalesce(sum(${studySession.minutesActive}), 0)` })
        .from(studySession)
        .where(
          range
            ? and(gte(studySession.startedAt, range.from), lt(studySession.startedAt, range.to))
            : undefined,
        )
        .get();
      return row?.total ?? 0;
    },
  };
}
