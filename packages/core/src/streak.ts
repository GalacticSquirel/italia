import { addDays, daysBetween, type LocalDate, type LocalDateFn } from './local-date';

/**
 * Streak rules. A day counts only for real study, missed days are covered
 * by earned freezes, and one uncovered missed day can be repaired with a
 * double session within the repair window.
 */
export interface StreakConfig {
  /** Maps an instant to the learner's local date. */
  localDate: LocalDateFn;
  /** Active minutes that make a day count (a completed session also does). Defaults to 10. */
  minActiveMinutes?: number;
  /** A freeze is earned each time the streak reaches a multiple of this. Defaults to 7. */
  freezeEveryDays?: number;
  /** Most freezes that can be banked. Defaults to 2. */
  maxFreezes?: number;
  /**
   * Days after a missed day in which it can be repaired. Defaults to 2
   * (48 hours: the two local days after the missed one).
   */
  repairWindowDays?: number;
  /** A repair needs this many times the daily minimum on one day. Defaults to 2. */
  repairMultiplier?: number;
}

/** Study recorded so far on one local day. */
export interface DayProgress {
  date: LocalDate;
  activeMinutes: number;
  completedSessions: number;
}

/** A missed day that can still be repaired. */
export interface PendingRepair {
  /** The missed day the repair would cover. */
  missedDate: LocalDate;
  /** The streak before it broke. */
  lostDays: number;
  /** Freezes the repair will spend to cover earlier missed days. */
  freezesNeeded: number;
}

/**
 * Persisted streak state. `currentDays`, `longestDays`, `lastStudyDate` and
 * `freezesAvailable` map onto the `streak_state` table; `day` and `repair`
 * need storing too.
 */
export interface StreakState {
  currentDays: number;
  longestDays: number;
  /** Last local day that counted, or null before the first. */
  lastStudyDate: LocalDate | null;
  freezesAvailable: number;
  /** Progress on the most recent day with any study. */
  day: DayProgress | null;
  repair: PendingRepair | null;
}

/** State before any study. */
export const INITIAL_STREAK_STATE: StreakState = {
  currentDays: 0,
  longestDays: 0,
  lastStudyDate: null,
  freezesAvailable: 0,
  day: null,
  repair: null,
};

/** Study to record. */
export interface StudyActivity {
  /** When the study happened (end of the activity). */
  at: Date;
  /** Active minutes in this activity (idle time excluded). */
  activeMinutes: number;
  /** True when this activity completed a session. */
  completedSession?: boolean;
}

/** Something that happened to the streak, for feedback in the UI. */
export type StreakEvent =
  | { type: 'day_counted'; date: LocalDate }
  | { type: 'freeze_used'; date: LocalDate }
  | { type: 'freeze_earned' }
  | { type: 'streak_reset'; lostDays: number }
  | { type: 'repair_offered'; missedDate: LocalDate; expiresOn: LocalDate }
  | { type: 'repaired'; restoredDays: number }
  | { type: 'repair_expired' };

/** Result of {@link recordStudy}. */
export interface StreakUpdate {
  state: StreakState;
  events: StreakEvent[];
}

interface Rules {
  localDate: LocalDateFn;
  minActiveMinutes: number;
  freezeEveryDays: number;
  maxFreezes: number;
  repairWindowDays: number;
  repairMultiplier: number;
}

function resolve(config: StreakConfig): Rules {
  const rules = {
    localDate: config.localDate,
    minActiveMinutes: config.minActiveMinutes ?? 10,
    freezeEveryDays: config.freezeEveryDays ?? 7,
    maxFreezes: config.maxFreezes ?? 2,
    repairWindowDays: config.repairWindowDays ?? 2,
    repairMultiplier: config.repairMultiplier ?? 2,
  };
  if (!(rules.minActiveMinutes > 0)) throw new RangeError('minActiveMinutes must be positive');
  for (const key of ['freezeEveryDays', 'repairMultiplier'] as const) {
    if (!Number.isSafeInteger(rules[key]) || rules[key] < 1) {
      throw new RangeError(`${key} must be a positive whole number`);
    }
  }
  for (const key of ['maxFreezes', 'repairWindowDays'] as const) {
    if (!Number.isSafeInteger(rules[key]) || rules[key] < 0) {
      throw new RangeError(`${key} must be a non-negative whole number`);
    }
  }
  return rules;
}

function qualifies(day: DayProgress, rules: Rules): boolean {
  return day.activeMinutes >= rules.minActiveMinutes || day.completedSessions >= 1;
}

function isDouble(day: DayProgress, rules: Rules): boolean {
  return (
    day.activeMinutes >= rules.minActiveMinutes * rules.repairMultiplier ||
    day.completedSessions >= rules.repairMultiplier
  );
}

/** Multiples of `every` in the interval (from, to]. */
function multiplesCrossed(from: number, to: number, every: number): number {
  return Math.max(0, Math.floor(to / every) - Math.floor(from / every));
}

/**
 * Record study and advance the streak. Pure: returns the new state and the
 * events it caused.
 *
 * Activity dated before the day in progress (for example after a clock
 * change) counts towards the day in progress.
 *
 * @throws RangeError when `activeMinutes` is negative or a config value is invalid
 */
export function recordStudy(
  state: StreakState,
  activity: StudyActivity,
  config: StreakConfig,
): StreakUpdate {
  const rules = resolve(config);
  if (!(Number.isFinite(activity.activeMinutes) && activity.activeMinutes >= 0)) {
    throw new RangeError('activeMinutes must be a non-negative number');
  }
  const events: StreakEvent[] = [];
  let today = rules.localDate(activity.at);
  if (state.day !== null && daysBetween(state.day.date, today) < 0) {
    today = state.day.date;
  }

  const previous: DayProgress =
    state.day?.date === today ? state.day : { date: today, activeMinutes: 0, completedSessions: 0 };
  const day: DayProgress = {
    date: today,
    activeMinutes: previous.activeMinutes + activity.activeMinutes,
    completedSessions: previous.completedSessions + (activity.completedSession === true ? 1 : 0),
  };

  let { currentDays, freezesAvailable, repair } = state;
  const earn = (from: number, to: number) => {
    const earned = Math.min(
      multiplesCrossed(from, to, rules.freezeEveryDays),
      rules.maxFreezes - freezesAvailable,
    );
    for (let i = 0; i < earned; i++) events.push({ type: 'freeze_earned' });
    freezesAvailable += Math.max(0, earned);
  };

  if (repair !== null && daysBetween(repair.missedDate, today) > rules.repairWindowDays) {
    events.push({ type: 'repair_expired' });
    repair = null;
  }

  let lastStudyDate = state.lastStudyDate;
  if (qualifies(day, rules) && lastStudyDate !== today) {
    const missed = lastStudyDate === null ? 0 : daysBetween(lastStudyDate, today) - 1;
    if (lastStudyDate === null || missed <= 0) {
      // First day, or consecutive.
    } else if (missed <= freezesAvailable) {
      for (let i = 1; i <= missed; i++) {
        events.push({ type: 'freeze_used', date: addDays(lastStudyDate, i) });
      }
      freezesAvailable -= missed;
    } else if (missed - freezesAvailable === 1 && rules.repairWindowDays >= 1) {
      // Freezes cover the earlier days; the latest missed day can be repaired.
      const missedDate = addDays(today, -1);
      events.push({ type: 'streak_reset', lostDays: currentDays });
      events.push({
        type: 'repair_offered',
        missedDate,
        expiresOn: addDays(missedDate, rules.repairWindowDays),
      });
      repair = { missedDate, lostDays: currentDays, freezesNeeded: freezesAvailable };
      currentDays = 0;
    } else {
      events.push({ type: 'streak_reset', lostDays: currentDays });
      repair = null;
      currentDays = 0;
    }
    const before = currentDays;
    currentDays += 1;
    lastStudyDate = today;
    events.push({ type: 'day_counted', date: today });
    earn(before, currentDays);
  }

  if (
    repair !== null &&
    lastStudyDate === today &&
    isDouble(day, rules) &&
    repair.freezesNeeded <= freezesAvailable
  ) {
    const restored = repair.lostDays + currentDays;
    freezesAvailable -= repair.freezesNeeded;
    events.push({ type: 'repaired', restoredDays: restored });
    earn(repair.lostDays, restored);
    currentDays = restored;
    repair = null;
  }

  return {
    state: {
      currentDays,
      longestDays: Math.max(state.longestDays, currentDays),
      lastStudyDate,
      freezesAvailable,
      day,
      repair,
    },
    events,
  };
}

/**
 * Streak status for display:
 *
 * - `none`: no study yet
 * - `active`: today already counts
 * - `due_today`: yesterday counted; study today to extend
 * - `frozen`: days were missed but freezes will cover them on the next study
 * - `repairable`: one uncovered missed day; a double session will repair it
 * - `broken`: too many missed days; the next study starts a new streak
 */
export type StreakStatus = 'none' | 'active' | 'due_today' | 'frozen' | 'repairable' | 'broken';

/** Result of {@link viewStreak}. */
export interface StreakView {
  status: StreakStatus;
  /** Streak to show: 0 when broken. */
  currentDays: number;
  longestDays: number;
  freezesAvailable: number;
  studiedToday: boolean;
  /** Active minutes recorded today. */
  todayMinutes: number;
  /** A repair the learner can still make, if any. */
  repair: { missedDate: LocalDate; lostDays: number; expiresOn: LocalDate } | null;
}

/** Describe the streak as of `now`, without changing it. */
export function viewStreak(state: StreakState, now: Date, config: StreakConfig): StreakView {
  const rules = resolve(config);
  const today = rules.localDate(now);
  const todayMinutes = state.day?.date === today ? state.day.activeMinutes : 0;
  const base = {
    longestDays: state.longestDays,
    freezesAvailable: state.freezesAvailable,
    todayMinutes,
  };

  let repair: StreakView['repair'] = null;
  if (state.repair !== null) {
    const expiresOn = addDays(state.repair.missedDate, rules.repairWindowDays);
    if (daysBetween(today, expiresOn) >= 0) {
      repair = {
        missedDate: state.repair.missedDate,
        lostDays: state.repair.lostDays,
        expiresOn,
      };
    }
  }

  if (state.lastStudyDate === null) {
    return { ...base, status: 'none', currentDays: 0, studiedToday: false, repair };
  }
  const studiedToday = state.lastStudyDate === today;
  const missed = studiedToday ? 0 : daysBetween(state.lastStudyDate, today) - 1;
  const view = { ...base, studiedToday, currentDays: state.currentDays, repair };
  if (studiedToday) return { ...view, status: 'active' };
  if (missed <= 0) return { ...view, status: 'due_today' };
  if (missed <= state.freezesAvailable) return { ...view, status: 'frozen' };
  if (missed - state.freezesAvailable === 1 && rules.repairWindowDays >= 1) {
    const missedDate = addDays(today, -1);
    return {
      ...view,
      status: 'repairable',
      repair: {
        missedDate,
        lostDays: state.currentDays,
        expiresOn: addDays(missedDate, rules.repairWindowDays),
      },
    };
  }
  return { ...view, status: 'broken', currentDays: 0 };
}
