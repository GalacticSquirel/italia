import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import { cardIdFor } from '@/data';
import { schedule } from '@/data/testing/fixtures';
import { createTestApp, type TestApp } from '@/testing/testApp';

import { ReviewScreen } from './ReviewScreen';
import { WordScreen } from './WordScreen';

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
  const now = new Date();
  app.repos.cards.create({
    kind: 'cloze_production',
    targetId: 11, // casa
    promptMode: 'typed',
    schedule: schedule(
      {
        state: 'review',
        stability: 12,
        difficulty: 4,
        reps: 3,
        due: new Date(now.getTime() + 2 * 86_400_000),
        lastReview: new Date(now.getTime() - 86_400_000),
      },
      now,
    ),
  });
});

afterEach(() => {
  app.t.close();
});

describe('Review tab', () => {
  it('browses cards by state and suspends them', async () => {
    const user = userEvent.setup();
    await render(app.wrap(<ReviewScreen />));
    expect(screen.getByRole('tab', { name: 'Review, 1 card' })).toBeSelected();
    expect(screen.getByText('casa')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Suspend casa' }));
    expect(app.repos.cards.getById(cardIdFor('cloze_production', 11, 'typed'))?.suspended).toBe(
      true,
    );
    expect(screen.getByText('No review cards')).toBeOnTheScreen();
    await user.press(screen.getByRole('tab', { name: 'Suspended, 1 card' }));
    await user.press(screen.getByRole('button', { name: 'Resume casa' }));
    expect(app.repos.cards.getById(cardIdFor('cloze_production', 11, 'typed'))?.suspended).toBe(
      false,
    );
  });

  it('searches words and opens one', async () => {
    const user = userEvent.setup();
    await render(app.wrap(<ReviewScreen />));
    await user.type(screen.getByLabelText('Search words'), 'cat');
    expect(screen.getByText('1 word found')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'gatto, cat' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/word/[id]', params: { id: '30' } });
  });

  it('shows a word with its sentences and FSRS stats', async () => {
    const user = userEvent.setup();
    await render(app.wrap(<WordScreen lemmaId={11} />));
    expect(screen.getByText('house, home')).toBeOnTheScreen();
    expect(screen.getByText('He works at home.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Stability: 12 days')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Recall now: \d+%$/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Next review: due in 2 days')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Suspend card' }));
    expect(screen.getByRole('button', { name: 'Resume card' })).toBeOnTheScreen();
  });
});
