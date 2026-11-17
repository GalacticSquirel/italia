import { render, screen, userEvent } from '@testing-library/react-native';
import * as Speech from 'expo-speech';
import { AccessibilityInfo } from 'react-native';

import { createTestApp, type TestApp } from '@/testing/testApp';

import { SessionProvider } from './SessionContext';
import { SessionScreen } from './SessionScreen';
import { createSessionStore, type SessionStore } from './sessionStore';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));

let app: TestApp;
let clock: number;

beforeEach(async () => {
  app = await createTestApp();
  clock = new Date(2026, 10, 16, 9, 0, 0).getTime();
});

afterEach(() => {
  app.t.close();
});

async function renderSession(): Promise<SessionStore> {
  const store = createSessionStore({
    repos: app.repos,
    now: () => {
      clock += 5_000;
      return new Date(clock);
    },
  });
  await render(
    app.wrap(
      <SessionProvider store={store}>
        <SessionScreen />
      </SessionProvider>,
    ),
  );
  return store;
}

describe('SessionScreen', () => {
  it('runs a whole session through the UI and shows the summary', async () => {
    app.repos.settings.set('dailyNewLimit', 2);
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const user = userEvent.setup();
    const store = await renderSession();

    // First exposure: the word, its meaning and Italian audio.
    expect(screen.getByText('New word')).toBeOnTheScreen();
    expect(screen.getByText('essere')).toBeOnTheScreen();
    expect(Speech.speak).toHaveBeenCalledWith(
      expect.stringContaining('essere'),
      expect.objectContaining({ language: 'it-IT' }),
    );

    let guard = 0;
    let typedOnce = false;
    while (!screen.queryByText('Session complete') && guard++ < 40) {
      const gotIt = screen.queryByRole('button', { name: 'Got it' });
      if (gotIt) {
        await user.press(gotIt);
        continue;
      }
      const prompt = store.getState().prompt;
      if (!prompt || prompt.kind === 'recognition') throw new Error('expected a typed prompt');
      await user.type(screen.getByLabelText('Missing word'), prompt.accepted[0] ?? '');
      await user.press(screen.getByRole('button', { name: 'Check' }));
      expect(screen.getByText('Correct!')).toBeOnTheScreen();
      if (!typedOnce) {
        expect(announce).toHaveBeenCalledWith('Correct!');
        typedOnce = true;
      }
      await user.press(screen.getByRole('button', { name: 'Continue' }));
    }

    expect(screen.getByText('Session complete')).toBeOnTheScreen();
    expect(screen.getByLabelText('Accuracy: 100%')).toBeOnTheScreen();
    expect(screen.getByLabelText('New words: 2')).toBeOnTheScreen();
    expect(screen.getByText('Today counts towards your streak.')).toBeOnTheScreen();
    // Quick exact answers are rated Easy, so no new item needed a repeat.
    expect(app.repos.reviewLogs.count()).toBe(4);
    expect(store.getState().summary?.answers).toBe(4);
    expect(app.repos.streak.get().currentDays).toBe(1);
  });

  it('shows the diff and lets the learner override a wrong grade', async () => {
    app.repos.settings.set('dailyNewLimit', 2);
    const user = userEvent.setup();
    const store = await renderSession();
    while (screen.queryByRole('button', { name: 'Got it' })) {
      await user.press(screen.getByRole('button', { name: 'Got it' }));
    }
    const cardId = store.getState().entry?.item.cardId ?? '';
    await user.type(screen.getByLabelText('Missing word'), 'xyz');
    await user.press(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByText('Not quite.')).toBeOnTheScreen();
    expect(screen.getByText('Your answer')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Correct answer: /)).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'I was right' }));
    expect(screen.getByText('Counted as Good')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'I was right' })).toBeNull();
    await user.press(screen.getByRole('button', { name: 'Continue' }));
    const [log] = app.repos.reviewLogs.listForCard(cardId);
    expect(log?.rating).toBe('good');
    expect(log?.answer).toContain('"override"');
  });

  it('shows an empty state when nothing is due', async () => {
    app.repos.settings.set('dailyNewLimit', 0);
    await renderSession();
    expect(screen.getByText('Nothing to study right now')).toBeOnTheScreen();
  });
});
