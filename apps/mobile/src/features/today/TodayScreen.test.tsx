import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

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
});
