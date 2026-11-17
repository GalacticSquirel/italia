import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import { createScheduler } from '@italia/core';

import { importStories } from '@/data';
import { FIXTURE_STORIES } from '@/testing/fixtureStories';
import { createTestApp, type TestApp } from '@/testing/testApp';

import { TodayScreen } from './TodayScreen';
import { summariseToday } from './useTodayPlan';

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<{
    useEffect: (effect: () => void, deps: unknown[]) => void;
  }>('react');
  return {
    router: { push: jest.fn() },
    useFocusEffect: (effect: () => void) => {
      useEffect(effect, [effect]);
    },
  };
});

let app: TestApp;

beforeEach(async () => {
  app = await createTestApp();
});

afterEach(() => {
  app.t.close();
});

describe('Today', () => {
  it('plans 20 new words by default with core estimates and no streak yet', () => {
    const s = summariseToday(app.repos, new Date(2026, 10, 16, 9));
    expect(s.newWords).toBe(20);
    expect(s.reviews).toBe(0);
    expect(s.estimatedMinutes).toBeGreaterThan(0);
    expect(s.wordsAvailable).toBe(33);
    expect(s.streak.status).toBe('none');
  });

  it('shows the plan card and starts a session', async () => {
    const user = userEvent.setup();
    await render(app.wrap(<TodayScreen />));
    expect(screen.getByLabelText('New words: 20')).toBeOnTheScreen();
    expect(screen.getByLabelText('Reviews due: 0')).toBeOnTheScreen();
    expect(screen.getByLabelText('Current streak: 0 days')).toBeOnTheScreen();
    expect(
      screen.getByText('Study for 10 minutes or finish a session to start a streak.'),
    ).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Start session' }));
    expect(router.push).toHaveBeenCalledWith('/session');
  });

  it('shows an empty state when there is nothing to do', async () => {
    app.repos.settings.set('dailyNewLimit', 0);
    await render(app.wrap(<TodayScreen />));
    expect(screen.getByText('Done for today')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Start session' })).toBeNull();
  });

  it('plans one story as the reading block, honestly when none fits yet', async () => {
    const now = new Date(2026, 10, 16, 9);
    expect(summariseToday(app.repos, now).reading).toBeNull();
    importStories(app.t.db, FIXTURE_STORIES);
    // A new learner knows no words yet: the closest story is shown, with its coverage.
    expect(summariseToday(app.repos, now).reading).toMatchObject({ kind: 'closest', readToday: 0 });
    await render(app.wrap(<TodayScreen />));
    expect(screen.getByText(/Stories open up once you know at least 90%/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Read the next story' })).toBeNull();
  });

  it('offers the next story once its words are known', async () => {
    importStories(app.t.db, FIXTURE_STORIES);
    const now = new Date();
    const scheduler = createScheduler();
    app.repos.cards.createMany(
      Array.from({ length: 33 }, (_, i) => ({
        kind: 'cloze_production' as const,
        targetId: i + 1,
        promptMode: 'typed' as const,
        schedule: {
          ...scheduler.newCard(now),
          state: 'review' as const,
          stability: 60,
          reps: 5,
          due: new Date(now.getTime() + 30 * 86_400_000),
          lastReview: new Date(now.getTime() - 86_400_000),
        },
      })),
    );
    const reading = summariseToday(app.repos, now).reading;
    expect(reading).toMatchObject({ kind: 'next', coverage: 1 });
    const user = userEvent.setup();
    await render(app.wrap(<TodayScreen />));
    await user.press(screen.getByRole('button', { name: 'Read the next story' }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/story/[id]',
      params: { id: reading?.storyId },
    });
  });
});
