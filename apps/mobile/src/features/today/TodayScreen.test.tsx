import { render, screen, userEvent, within } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ACTIVITIES, createScheduler } from '@italia/core';

import { importStories, type Repositories } from '@/data';
import { FIXTURE_STORIES } from '@/testing/fixtureStories';
import { createTestApp, type TestApp } from '@/testing/testApp';

import * as dailyPath from './dailyPath';
import { TodayScreen } from './TodayScreen';

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
  jest.mocked(router.push).mockClear();
});

afterEach(() => {
  app.t.close();
  jest.restoreAllMocks();
});

/** Record that `activities` were finished today. */
function finished(repos: Repositories, ...activities: string[]) {
  const now = new Date();
  const { id } = repos.studySessions.start(now);
  for (const a of activities) repos.studySessions.addActivity(id, a);
  repos.studySessions.end(id, now);
}

/** Make every fixture word known, so the fixture stories fit. */
function knowAllWords(repos: Repositories) {
  const now = new Date();
  const scheduler = createScheduler();
  repos.cards.createMany(
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
}

describe('Today', () => {
  it('gives a beginner one clear next step and the path after it', async () => {
    const user = userEvent.setup();
    await render(app.wrap(<TodayScreen />));

    const upNext = screen.getByTestId('up-next');
    expect(within(upNext).getByText('Up next · step 1 of 3')).toBeOnTheScreen();
    expect(within(upNext).getByText('New words and grammar')).toBeOnTheScreen();
    expect(within(upNext).getByText(/^20 new words/)).toBeOnTheScreen();
    expect(screen.getByText(/^0 of 3 steps done · about \d+ min left$/)).toBeOnTheScreen();
    expect(screen.getByLabelText("Today's path: 0 of 3 steps done")).toBeOnTheScreen();

    expect(
      screen.getByLabelText(/^Step 1, New words and grammar, 20 new words.*, up next$/),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Step 2, Ear training, .*, later$/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Step 3, Shadowing, .*, later$/)).toBeOnTheScreen();

    // What joins the path later, and why it is not there yet.
    const unlocks = screen.getByTestId('unlocks');
    expect(
      within(unlocks).getByText(/Conversation with the tutor joins your path/),
    ).toBeOnTheScreen();
    expect(screen.getByText('Streak: 0 days')).toBeOnTheScreen();

    await user.press(within(upNext).getByRole('button', { name: 'Start learning' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/session', params: { part: 'learn' } });
  });

  it('skips a step for today and moves on', async () => {
    const user = userEvent.setup();
    await render(app.wrap(<TodayScreen />));
    await user.press(screen.getByRole('button', { name: 'Skip for today' }));

    const upNext = screen.getByTestId('up-next');
    expect(within(upNext).getByText('Ear training')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Step 1, New words and grammar, .*, skipped$/)).toBeOnTheScreen();
    expect(screen.getByText('Skipped today')).toBeOnTheScreen();
    // A skipped step can still be opened from the path.
    await user.press(screen.getByLabelText(/^Step 1, New words and grammar/));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/session', params: { part: 'learn' } });
  });

  it('moves to the story once the learning is done and a story fits', async () => {
    importStories(app.t.db, FIXTURE_STORIES);
    knowAllWords(app.repos);
    app.repos.settings.set('dailyNewLimit', 0);
    const user = userEvent.setup();
    await render(app.wrap(<TodayScreen />));

    const upNext = screen.getByTestId('up-next');
    expect(within(upNext).getByText('Listen and read')).toBeOnTheScreen();
    expect(within(upNext).getByText(/You know 100% of its words/)).toBeOnTheScreen();
    await user.press(within(upNext).getByRole('button', { name: 'Start reading' }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/story/[id]',
      params: { id: expect.any(String) as unknown },
    });
    expect(screen.queryByTestId('unlocks')).toBeOnTheScreen();
    expect(screen.queryByText(/Stories join your path/)).toBeNull();
  });

  it('marks finished steps done and opens them again on request', async () => {
    finished(app.repos, ACTIVITIES.learn, ACTIVITIES.earTraining);
    const user = userEvent.setup();
    await render(app.wrap(<TodayScreen />));
    expect(screen.getByLabelText(/^Step 2, Ear training, .*, done$/)).toBeOnTheScreen();
    expect(within(screen.getByTestId('up-next')).getByText('Shadowing')).toBeOnTheScreen();
    expect(screen.getByText(/^2 of 3 steps done/)).toBeOnTheScreen();
    await user.press(screen.getByLabelText(/^Step 2, Ear training/));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/speak/ear' });
  });

  it('says the day is complete and offers extra practice', async () => {
    importStories(app.t.db, FIXTURE_STORIES);
    knowAllWords(app.repos);
    app.repos.settings.set('dailyNewLimit', 0);
    finished(app.repos, ACTIVITIES.story, ACTIVITIES.shadowing);
    await render(app.wrap(<TodayScreen />));
    expect(screen.getByTestId('day-complete')).toBeOnTheScreen();
    expect(screen.getByText(/^All 2 steps done/)).toBeOnTheScreen();
    const extra = screen.getByTestId('up-next');
    expect(within(extra).getByText('If you have more time')).toBeOnTheScreen();
    expect(within(extra).getByRole('button', { name: 'Start reading' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Skip for today' })).toBeNull();
  });

  it('shows an error with a retry when the path cannot load', async () => {
    const load = jest.spyOn(dailyPath, 'loadToday').mockImplementation(() => {
      throw new Error('Database is locked.');
    });
    const user = userEvent.setup();
    await render(app.wrap(<TodayScreen />));
    expect(screen.getByText("Today's path could not load")).toBeOnTheScreen();
    expect(screen.getByText(/Database is locked\./)).toBeOnTheScreen();
    load.mockRestore();
    await user.press(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByTestId('up-next')).toBeOnTheScreen();
  });

  it('opens Settings from the header', async () => {
    const user = userEvent.setup();
    await render(app.wrap(<TodayScreen />));
    await user.press(screen.getByRole('button', { name: 'Settings' }));
    expect(router.push).toHaveBeenCalledWith('/settings');
  });
});
