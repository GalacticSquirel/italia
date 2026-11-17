import { createRepositories, type Repositories } from '@/data';
import {
  createTestDatabase,
  sequentialIds,
  type TestDatabase,
} from '@/db/testing/createTestDatabase';

import { startPracticeSession } from './practiceSession';

let t: TestDatabase;
let repos: Repositories;
let clock: number;
const now = () => new Date(clock);
const minutes = (n: number) => {
  clock += n * 60_000;
};

beforeEach(() => {
  t = createTestDatabase();
  repos = createRepositories(t.db, { newId: sequentialIds() });
  clock = new Date(2026, 10, 16, 9, 0, 0).getTime();
});

afterEach(() => {
  t.close();
});

describe('startPracticeSession', () => {
  it('saves active time to a study session and the streak', () => {
    const ended = jest.fn();
    const s = startPracticeSession(repos, 'speaking_drill', now, ended);
    s.resume();
    for (let i = 0; i < 6; i++) {
      minutes(2);
      s.touch();
    }
    const events = s.complete();
    minutes(1);
    s.close();

    const [session] = repos.studySessions.listBetween(new Date(0), new Date(clock + 1));
    expect(session?.minutesActive).toBeCloseTo(13);
    expect(session?.activities).toEqual(['speaking_drill']);
    expect(session?.endedAt).toEqual(now());
    expect(ended).toHaveBeenCalledTimes(1);
    expect(events.length).toBeGreaterThan(0);
    expect(repos.streak.get().currentDays).toBe(1);
  });

  it('caps idle stretches and counts nothing while paused', () => {
    const s = startPracticeSession(repos, 'ear_training', now);
    s.resume();
    minutes(30); // left the phone on the screen
    s.touch();
    s.pause();
    minutes(60); // app in the background
    s.resume();
    minutes(1);
    s.close();
    expect(repos.studySessions.totalActiveMinutes()).toBeCloseTo(6);
    // Not completed: no activity recorded.
    expect(repos.studySessions.listBetween(new Date(0), now())[0]?.activities).toEqual([]);
  });

  it('starts no study session when nothing was practised', () => {
    const ended = jest.fn();
    const s = startPracticeSession(repos, 'shadowing', now, ended);
    s.close();
    expect(repos.studySessions.totalActiveMinutes()).toBe(0);
    expect(repos.studySessions.getActive()).toBeNull();
    expect(ended).not.toHaveBeenCalled();
  });

  it('counts a completion once', () => {
    const s = startPracticeSession(repos, 'conversation', now);
    s.resume();
    minutes(3);
    s.complete();
    s.complete();
    s.close();
    const [session] = repos.studySessions.listBetween(new Date(0), new Date(clock + 1));
    expect(session?.activities).toEqual(['conversation']);
    expect(repos.streak.get().day?.completedSessions).toBe(1);
  });
});
