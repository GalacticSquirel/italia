import { INITIAL_STREAK_STATE, recordStudy, type StreakConfig, type StreakState } from './streak';

/** A study session as streak replay needs it. */
export interface ReplaySession {
  /** Session id; breaks ties between sessions recorded at the same instant. */
  id: string;
  startedAt: Date;
  /** Null while the session is still running. */
  endedAt: Date | null;
  /** Active study minutes (idle time excluded). */
  minutesActive: number;
  /**
   * Activities completed in the session. When given, the session counts as
   * a completed session only if it completed at least one activity (live
   * study records a completed session only when a review session or story is
   * finished, not when it is quit). When absent, every ended session counts.
   */
  activities?: readonly string[];
}

/**
 * Rebuild the streak from study sessions alone, by feeding them to
 * {@link recordStudy} in time order. An ended session counts at its end time,
 * as a completed session when it completed an activity; a running one contributes its minutes at its start
 * time. Deterministic: the same sessions in any order give the same state, so
 * devices that exchange sessions agree on the streak.
 */
export function replayStreak(
  sessions: readonly ReplaySession[],
  config: StreakConfig,
): StreakState {
  const events = sessions
    .map((s) => ({ s, at: s.endedAt ?? s.startedAt }))
    .sort(
      (a, b) => a.at.getTime() - b.at.getTime() || (a.s.id < b.s.id ? -1 : a.s.id > b.s.id ? 1 : 0),
    );
  let state = INITIAL_STREAK_STATE;
  for (const { s, at } of events) {
    state = recordStudy(
      state,
      {
        at,
        activeMinutes: s.minutesActive,
        completedSession:
          s.endedAt !== null && (s.activities === undefined || s.activities.length > 0),
      },
      config,
    ).state;
  }
  return state;
}
