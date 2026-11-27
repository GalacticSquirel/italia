import { ACTIVITIES, createScheduler } from '@italia/core';

import type { Repositories } from '@/data';
import { createTestApp, type TestApp } from '@/testing/testApp';
import type { TutorModelChoice } from '@/tutor';

import { loadSkippedSteps, loadToday, skipStep } from './dailyPath';

let app: TestApp;

beforeEach(async () => {
  app = await createTestApp();
});

afterEach(() => {
  app.t.close();
});

const NOW = new Date(2026, 10, 16, 9);
const noTutor: TutorModelChoice = { state: 'unavailable' };

/** Cards for `count` reviews due at NOW. */
function dueReviews(repos: Repositories, count: number) {
  const scheduler = createScheduler();
  const past = new Date(NOW.getTime() - 30 * 86_400_000);
  const card = scheduler.review(scheduler.newCard(past), 'good', past).card;
  repos.cards.createMany(
    Array.from({ length: count }, (_, i) => ({
      kind: 'cloze_production' as const,
      targetId: i + 1,
      promptMode: 'typed' as const,
      schedule: { ...card, due: new Date(NOW.getTime() - 60_000) },
    })),
  );
}

describe('loadToday', () => {
  it('starts with due reviews, then learning', () => {
    dueReviews(app.repos, 3);
    const today = loadToday(app.repos, NOW, noTutor);
    expect(today.steps.map((s) => s.title)).toEqual([
      'Warm-up reviews',
      'New words and grammar',
      'Ear training',
      'Shadowing',
    ]);
    expect(today.next?.detail).toBe('3 reviews');
    expect(today.next?.target).toEqual({ pathname: '/session', params: { part: 'reviews' } });
    expect(today.minutesLeft).toBeGreaterThan(today.next?.minutes ?? 0);
    // No tutor on this phone: conversation is not promised.
    expect(today.unlocks.map((u) => u.key)).toEqual([]);
  });

  it('offers reviews that came due as the extra once the path is done', () => {
    app.repos.settings.set('dailyNewLimit', 0);
    dueReviews(app.repos, 2);
    const { id } = app.repos.studySessions.start(NOW);
    for (const a of [ACTIVITIES.reviews, ACTIVITIES.earTraining, ACTIVITIES.shadowing]) {
      app.repos.studySessions.addActivity(id, a);
    }
    app.repos.studySessions.end(id, NOW);
    const today = loadToday(app.repos, NOW, noTutor);
    expect(today.next).toBeNull();
    expect(today.extra?.title).toBe('More reviews are due');
    expect(today.extra?.why).toMatch(/^2 reviews have come due/);
  });

  it('asks for the tutor download only once it would be useful', () => {
    const needsDownload = { state: 'needs_download' } as TutorModelChoice;
    const today = loadToday(app.repos, NOW, needsDownload);
    expect(today.unlocks.find((u) => u.key === 'conversation')).toMatchObject({
      text: expect.stringMatching(/once you know about 150 more words/) as unknown,
      action: null,
    });
  });
});

describe('skipped steps', () => {
  it('are kept for the day they were skipped on only', () => {
    skipStep(app.repos, 'learn', NOW);
    skipStep(app.repos, 'listen', NOW);
    skipStep(app.repos, 'learn', NOW);
    expect(loadSkippedSteps(app.repos, NOW)).toEqual(['learn', 'listen']);
    expect(loadToday(app.repos, NOW, noTutor).next?.title).toBe('Shadowing');
    const tomorrow = new Date(NOW.getTime() + 86_400_000);
    expect(loadSkippedSteps(app.repos, tomorrow)).toEqual([]);
  });

  it('ignore unreadable saved data', () => {
    app.repos.meta.set('today.skipped', '{not json');
    expect(loadSkippedSteps(app.repos, NOW)).toEqual([]);
  });
});
