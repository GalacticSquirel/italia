import { describe, expect, it } from 'vitest';

import { recordStudy, replayStreak, INITIAL_STREAK_STATE, type ReplaySession } from './index';

const config = { localDate: (d: Date) => d.toISOString().slice(0, 10) };
const day = (n: number, hour = 12) => new Date(Date.UTC(2026, 5, 1 + n, hour));

function session(id: string, n: number, minutes = 15, ended = true): ReplaySession {
  return {
    id,
    startedAt: day(n, 11),
    endedAt: ended ? day(n, 12) : null,
    minutesActive: minutes,
  };
}

describe('replayStreak', () => {
  it('starts empty', () => {
    expect(replayStreak([], config)).toEqual(INITIAL_STREAK_STATE);
  });

  it('counts consecutive days from sessions in any order', () => {
    const sessions = [session('c', 2), session('a', 0), session('b', 1)];
    const state = replayStreak(sessions, config);
    expect(state.currentDays).toBe(3);
    expect(state.lastStudyDate).toBe('2026-06-03');
    expect(replayStreak([...sessions].reverse(), config)).toEqual(state);
  });

  it('matches recording the same sessions live', () => {
    const sessions = [session('a', 0), session('b', 1), session('c', 4), session('d', 5)];
    let live = INITIAL_STREAK_STATE;
    for (const s of sessions) {
      live = recordStudy(
        live,
        { at: s.endedAt ?? s.startedAt, activeMinutes: s.minutesActive, completedSession: true },
        config,
      ).state;
    }
    expect(replayStreak(sessions, config)).toEqual(live);
  });

  it('counts a running session by its minutes only', () => {
    expect(replayStreak([session('a', 0, 3, false)], config).currentDays).toBe(0);
    expect(replayStreak([session('a', 0, 12, false)], config).currentDays).toBe(1);
  });

  it('counts a quit session by its minutes only, like live study', () => {
    const quit = { ...session('a', 0, 3), activities: [] };
    expect(replayStreak([quit], config).currentDays).toBe(0);
    const finished = { ...session('a', 0, 3), activities: ['review_session'] };
    expect(replayStreak([finished], config).currentDays).toBe(1);
    expect(replayStreak([{ ...session('a', 0, 12), activities: [] }], config).currentDays).toBe(1);
  });
});
