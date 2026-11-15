import { describe, expect, it } from 'vitest';

import {
  addDays,
  daysBetween,
  INITIAL_STREAK_STATE,
  localDateInTimeZone,
  recordStudy,
  viewStreak,
  type StreakConfig,
  type StreakEvent,
  type StreakState,
} from './index';

const utcDate = (d: Date) => d.toISOString().slice(0, 10);
const config: StreakConfig = { localDate: utcDate };

/** Noon UTC on 2026-06-01 plus `day` days. */
function on(day: number, hour = 12): Date {
  return new Date(Date.UTC(2026, 5, 1 + day, hour));
}

function study(
  state: StreakState,
  day: number,
  minutes = 10,
  completedSession = false,
  cfg: StreakConfig = config,
): { state: StreakState; events: StreakEvent[] } {
  return recordStudy(state, { at: on(day), activeMinutes: minutes, completedSession }, cfg);
}

/** Study `days` consecutive days starting at day 0. */
function run(days: number, start: StreakState = INITIAL_STREAK_STATE): StreakState {
  let state = start;
  for (let d = 0; d < days; d++) state = study(state, d).state;
  return state;
}

describe('local dates', () => {
  it('does calendar arithmetic across months and leap days', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-12-30', '2027-01-02')).toBe(3);
    expect(() => addDays('2026-13-01', 1)).toThrow(RangeError);
  });

  it('computes the local date in a time zone', () => {
    const rome = localDateInTimeZone('Europe/Rome');
    // 23:30 UTC on 1 June is 01:30 on 2 June in Rome (UTC+2).
    expect(rome(new Date(Date.UTC(2026, 5, 1, 23, 30)))).toBe('2026-06-02');
    const la = localDateInTimeZone('America/Los_Angeles');
    expect(la(new Date(Date.UTC(2026, 5, 1, 3)))).toBe('2026-05-31');
  });
});

describe('recordStudy: counting days', () => {
  it('counts a day only after 10 active minutes or a completed session', () => {
    let { state, events } = study(INITIAL_STREAK_STATE, 0, 4);
    expect(state.currentDays).toBe(0);
    expect(events).toEqual([]);
    ({ state, events } = study(state, 0, 6));
    expect(state.currentDays).toBe(1);
    expect(events).toEqual([{ type: 'day_counted', date: '2026-06-01' }]);
    ({ state, events } = study(state, 0, 30));
    expect(state.currentDays).toBe(1);
    expect(events).toEqual([]);

    const session = study(INITIAL_STREAK_STATE, 0, 2, true);
    expect(session.state.currentDays).toBe(1);
  });

  it('extends on consecutive days and tracks the longest streak', () => {
    const state = run(5);
    expect(state.currentDays).toBe(5);
    expect(state.longestDays).toBe(5);
    expect(state.lastStudyDate).toBe('2026-06-05');
  });

  it('uses the injected local date to decide the day', () => {
    const rome: StreakConfig = { localDate: localDateInTimeZone('Europe/Rome') };
    // 23:00 and 23:30 UTC on consecutive days are both after midnight in Rome.
    let { state } = recordStudy(
      INITIAL_STREAK_STATE,
      { at: new Date(Date.UTC(2026, 5, 1, 23)), activeMinutes: 10 },
      rome,
    );
    ({ state } = recordStudy(
      state,
      { at: new Date(Date.UTC(2026, 5, 2, 21)), activeMinutes: 10 },
      rome,
    ));
    expect(state.lastStudyDate).toBe('2026-06-02');
    expect(state.currentDays).toBe(1);
  });

  it('honours a custom minimum', () => {
    const { state } = study(INITIAL_STREAK_STATE, 0, 5, false, { ...config, minActiveMinutes: 5 });
    expect(state.currentDays).toBe(1);
  });

  it('rejects negative minutes', () => {
    expect(() => study(INITIAL_STREAK_STATE, 0, -1)).toThrow(RangeError);
  });
});

describe('recordStudy: freezes', () => {
  it('earns one freeze per 7 days, at most 2 banked', () => {
    expect(run(6).freezesAvailable).toBe(0);
    expect(run(7).freezesAvailable).toBe(1);
    expect(run(14).freezesAvailable).toBe(2);
    expect(run(21).freezesAvailable).toBe(2);
  });

  it('spends freezes automatically to cover missed days', () => {
    const before = run(14); // last study day 13, 2 freezes
    const { state, events } = study(before, 16);
    expect(state.currentDays).toBe(15);
    expect(state.freezesAvailable).toBe(0);
    expect(events).toEqual([
      { type: 'freeze_used', date: '2026-06-15' },
      { type: 'freeze_used', date: '2026-06-16' },
      { type: 'day_counted', date: '2026-06-17' },
    ]);
  });

  it('keeps freezes when the gap is too long to save the streak', () => {
    const before = run(7); // 1 freeze
    const { state, events } = study(before, 12);
    expect(state.currentDays).toBe(1);
    expect(state.freezesAvailable).toBe(1);
    expect(events).toContainEqual({ type: 'streak_reset', lostDays: 7 });
    expect(state.longestDays).toBe(7);
  });
});

describe('recordStudy: repair', () => {
  it('restores the streak after one missed day when a double session is done in time', () => {
    const before = run(5); // days 0-4, no freezes
    // Day 5 missed. Day 6: a single session restarts the count and offers a repair.
    let { state, events } = study(before, 6);
    expect(state.currentDays).toBe(1);
    expect(state.repair).toEqual({ missedDate: '2026-06-06', lostDays: 5, freezesNeeded: 0 });
    expect(events).toEqual([
      { type: 'streak_reset', lostDays: 5 },
      { type: 'repair_offered', missedDate: '2026-06-06', expiresOn: '2026-06-08' },
      { type: 'day_counted', date: '2026-06-07' },
    ]);
    // Another 10 minutes the same day makes it a double session.
    ({ state, events } = study(state, 6));
    expect(events).toEqual([{ type: 'repaired', restoredDays: 6 }]);
    expect(state.currentDays).toBe(6);
    expect(state.repair).toBeNull();
  });

  it('allows the double session on the second day of the window', () => {
    let { state } = study(run(5), 6);
    ({ state } = study(state, 7, 20));
    expect(state.currentDays).toBe(7);
  });

  it('repairs immediately when the first session back is already double', () => {
    const { state, events } = study(run(5), 6, 0, true);
    expect(state.currentDays).toBe(1);
    const again = study(state, 6, 0, true);
    expect(again.state.currentDays).toBe(6);
    expect(events.map((e) => e.type)).not.toContain('repaired');
    const double = study(run(5), 6, 25);
    expect(double.state.currentDays).toBe(6);
  });

  it('expires the repair after 48 hours', () => {
    let { state } = study(run(5), 6);
    ({ state } = study(state, 7));
    const { state: later, events } = study(state, 8, 20);
    expect(events).toContainEqual({ type: 'repair_expired' });
    expect(later.currentDays).toBe(3);
    expect(later.repair).toBeNull();
  });

  it('uses freezes for all but one missed day and spends them only on repair', () => {
    const before = run(7); // 1 freeze; last study day 6
    // Days 7 and 8 missed; one freeze covers one, the other needs repair.
    let { state } = study(before, 9);
    expect(state.freezesAvailable).toBe(1);
    expect(state.repair).toEqual({ missedDate: '2026-06-09', lostDays: 7, freezesNeeded: 1 });
    ({ state } = study(state, 9));
    expect(state.currentDays).toBe(8);
    expect(state.freezesAvailable).toBe(0);
  });

  it('earns a freeze when the repaired streak crosses a multiple of 7', () => {
    const before = run(6);
    let { state } = study(before, 7);
    ({ state } = study(state, 7));
    expect(state.currentDays).toBe(7);
    expect(state.freezesAvailable).toBe(1);
  });
});

describe('viewStreak', () => {
  it('reports each status', () => {
    expect(viewStreak(INITIAL_STREAK_STATE, on(0), config).status).toBe('none');

    const five = run(5); // last study day 4
    expect(viewStreak(five, on(4), config)).toMatchObject({
      status: 'active',
      currentDays: 5,
      studiedToday: true,
      todayMinutes: 10,
    });
    expect(viewStreak(five, on(5), config)).toMatchObject({
      status: 'due_today',
      currentDays: 5,
      studiedToday: false,
      todayMinutes: 0,
    });
    expect(viewStreak(five, on(6), config)).toMatchObject({
      status: 'repairable',
      currentDays: 5,
      repair: { missedDate: '2026-06-06', lostDays: 5, expiresOn: '2026-06-08' },
    });
    expect(viewStreak(five, on(7), config)).toMatchObject({ status: 'broken', currentDays: 0 });

    const fourteen = run(14);
    expect(viewStreak(fourteen, on(16), config).status).toBe('frozen');
  });

  it('shows a pending repair after the streak restarts', () => {
    const { state } = study(run(5), 6);
    expect(viewStreak(state, on(7), config)).toMatchObject({
      status: 'due_today',
      currentDays: 1,
      repair: { missedDate: '2026-06-06', lostDays: 5, expiresOn: '2026-06-08' },
    });
    expect(viewStreak(state, on(9), config).repair).toBeNull();
  });
});

describe('streak properties', () => {
  it('never exceeds the freeze cap and longest is never below current', () => {
    let state = INITIAL_STREAK_STATE;
    let day = 0;
    let seed = 12345;
    const next = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    for (let i = 0; i < 500; i++) {
      day += next() < 0.8 ? 1 : 1 + Math.floor(next() * 4);
      state = study(state, day, Math.floor(next() * 30), next() < 0.3).state;
      expect(state.freezesAvailable).toBeGreaterThanOrEqual(0);
      expect(state.freezesAvailable).toBeLessThanOrEqual(2);
      expect(state.longestDays).toBeGreaterThanOrEqual(state.currentDays);
    }
  });
});
