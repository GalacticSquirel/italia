import { render, screen } from '@testing-library/react-native';

import { cardIdFor } from '@/data';
import { schedule } from '@/data/testing/fixtures';
import { createTestApp, type TestApp } from '@/testing/testApp';

import { CALENDAR_DAYS, FORECAST_DAYS, loadProgress } from './progressData';
import { ProgressScreen } from './ProgressScreen';

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<{
    useEffect: (effect: () => void, deps: unknown[]) => void;
  }>('react');
  return {
    useFocusEffect: (effect: () => void) => {
      useEffect(effect, [effect]);
    },
  };
});

let app: TestApp;
const DAY = 86_400_000;
const now = new Date(2026, 10, 16, 12, 0, 0);

beforeEach(async () => {
  app = await createTestApp();
});

afterEach(() => {
  app.t.close();
});

/** A word card reviewed long ago with high stability: known at `now`. */
function knownWord(lemmaId: number, reviewedDaysAgo: number) {
  const reviewedAt = new Date(now.getTime() - reviewedDaysAgo * DAY);
  const card = app.repos.cards.create({
    kind: 'cloze_production',
    targetId: lemmaId,
    promptMode: 'typed',
    schedule: schedule({}, reviewedAt),
    createdAt: reviewedAt,
  });
  app.repos.recordReview({
    cardId: card.id,
    rating: 'easy',
    answer: 'x',
    latencyMs: 1000,
    reviewedAt,
    deviceId: 'test',
    next: {
      due: new Date(now.getTime() + 3 * DAY),
      stability: 60,
      difficulty: 3,
      scheduledDays: 60,
      learningSteps: 0,
      reps: 1,
      lapses: 0,
      state: 'review',
      lastReview: new Date(now.getTime() - 1 * DAY),
    },
  });
  return card.id;
}

describe('progress', () => {
  it('wires known words, hours, CEFR, review load and the calendar to core', () => {
    knownWord(1, 1);
    knownWord(2, 1);
    expect(app.repos.cards.getById(cardIdFor('cloze_production', 1, 'typed'))?.state).toBe(
      'review',
    );
    const s = app.repos.studySessions.start(new Date(now.getTime() - 2 * 3_600_000));
    app.repos.studySessions.end(s.id, new Date(now.getTime() - 3_600_000), 90);

    const data = loadProgress(app.repos, now);
    expect(data.knownWords).toBe(2);
    expect(data.hours).toBeCloseTo(1.5, 5);
    expect(data.cefr.level).toBe('pre-A1');
    expect(data.cefr.nextLevel).toBe('A1');
    expect(data.cefr.lemmasToNextLevel).toBe(998);
    // Two known words gained in 1.5 observed hours: 998 / (2 / 1.5) hours to A1.
    expect(data.projection?.hours).toBeCloseTo(748.5, 5);
    expect(data.load).toHaveLength(FORECAST_DAYS);
    expect(data.load[3]?.reviews).toBe(2);
    expect(data.calendar).toHaveLength(CALENDAR_DAYS);
    expect(data.calendar.at(-1)).toEqual({ date: '2026-11-16', minutes: 90 });
    expect(data.calendar.filter((d) => d.minutes > 0)).toHaveLength(1);
  });

  it('gives no projection without enough study', () => {
    expect(loadProgress(app.repos, now).projection).toBeNull();
  });

  it('renders the progress screen', async () => {
    await render(app.wrap(<ProgressScreen />));
    expect(screen.getByLabelText('Words known: 0')).toBeOnTheScreen();
    expect(screen.getByLabelText('CEFR estimate: pre-A1')).toBeOnTheScreen();
    expect(screen.getByText('Studied on 0 of the last 30 days.')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Today: 0 reviews/)).toBeOnTheScreen();
  });
});
