import { describe, expect, it } from 'vitest';

import { createScheduler, DEFAULT_DESIRED_RETENTION, RATINGS, type CardSchedule } from './index';

const T0 = new Date('2026-01-01T09:00:00.000Z');
const MINUTE = 60_000;
const DAY = 86_400_000;

function at(base: Date, ms: number): Date {
  return new Date(base.getTime() + ms);
}

/** Review a card with `good` at each due time until it reaches the review state. */
function graduate(scheduler = createScheduler()): CardSchedule {
  let card = scheduler.newCard(T0);
  while (card.state !== 'review') {
    card = scheduler.review(card, 'good', card.due).card;
  }
  return card;
}

describe('createScheduler', () => {
  it('uses desired retention 0.9 by default', () => {
    expect(createScheduler().desiredRetention).toBe(DEFAULT_DESIRED_RETENTION);
    expect(DEFAULT_DESIRED_RETENTION).toBe(0.9);
  });

  it('rejects out-of-range options', () => {
    expect(() => createScheduler({ desiredRetention: 0.5 })).toThrow(RangeError);
    expect(() => createScheduler({ desiredRetention: 1 })).toThrow(RangeError);
    expect(() => createScheduler({ maximumIntervalDays: 0 })).toThrow(RangeError);
    expect(() => createScheduler({ maximumIntervalDays: 1.5 })).toThrow(RangeError);
  });
});

describe('newCard', () => {
  it('returns an unreviewed card due now', () => {
    const card = createScheduler().newCard(T0);
    expect(card).toEqual({
      due: T0,
      stability: 0,
      difficulty: 0,
      scheduledDays: 0,
      learningSteps: 0,
      reps: 0,
      lapses: 0,
      state: 'new',
      lastReview: null,
    });
    expect(card.due).not.toBe(T0);
  });

  it('rejects an invalid date', () => {
    expect(() => createScheduler().newCard(new Date(Number.NaN))).toThrow(RangeError);
  });
});

describe('review', () => {
  const scheduler = createScheduler();

  it('moves a new card into learning with a short step on good', () => {
    const { card, log } = scheduler.review(scheduler.newCard(T0), 'good', T0);
    expect(card.state).toBe('learning');
    expect(card.reps).toBe(1);
    expect(card.lastReview).toEqual(T0);
    expect(card.due).toEqual(at(T0, 10 * MINUTE));
    expect(card.stability).toBeGreaterThan(0);
    expect(card.difficulty).toBeGreaterThanOrEqual(1);
    expect(card.difficulty).toBeLessThanOrEqual(10);
    expect(log).toEqual({
      rating: 'good',
      reviewedAt: T0,
      elapsedDays: 0,
      previous: scheduler.newCard(T0),
    });
  });

  it('graduates a new card straight to review on easy', () => {
    const { card } = scheduler.review(scheduler.newCard(T0), 'easy', T0);
    expect(card.state).toBe('review');
    expect(card.scheduledDays).toBeGreaterThanOrEqual(1);
    expect(card.due.getTime()).toBe(T0.getTime() + card.scheduledDays * DAY);
  });

  it('orders intervals again < hard < good < easy for a review card', () => {
    const card = graduate();
    const now = card.due;
    const intervals = RATINGS.map(
      (rating) => scheduler.review(card, rating, now).card.due.getTime() - now.getTime(),
    );
    for (let i = 1; i < intervals.length; i++) {
      expect(intervals[i]).toBeGreaterThan(intervals[i - 1] ?? Infinity);
    }
  });

  it('counts a lapse and enters relearning when a review card is forgotten', () => {
    const card = graduate();
    const { card: after } = scheduler.review(card, 'again', card.due);
    expect(after.state).toBe('relearning');
    expect(after.lapses).toBe(card.lapses + 1);
    expect(after.stability).toBeLessThan(card.stability);
    expect(after.due).toEqual(at(card.due, 10 * MINUTE));

    const { card: relearned } = scheduler.review(after, 'good', after.due);
    expect(relearned.state).toBe('review');
  });

  it('records elapsed whole days since the previous review', () => {
    const card = graduate();
    const now = at(card.due, 2 * DAY);
    const { log } = scheduler.review(card, 'good', now);
    expect(card.lastReview).not.toBeNull();
    const expected = Math.floor((now.getTime() - (card.lastReview?.getTime() ?? 0)) / DAY);
    expect(log.elapsedDays).toBe(expected);
    expect(log.previous).toEqual(card);
  });

  it('is pure and deterministic', () => {
    const card = graduate();
    const snapshot = structuredClone(card);
    const a = scheduler.review(card, 'hard', card.due);
    const b = scheduler.review(card, 'hard', card.due);
    expect(a).toEqual(b);
    expect(card).toEqual(snapshot);
    a.log.previous.due.setTime(0);
    expect(card.due).toEqual(snapshot.due);
  });

  it('caps intervals at maximumIntervalDays', () => {
    const capped = createScheduler({ maximumIntervalDays: 3 });
    let card = graduate(capped);
    for (let i = 0; i < 5; i++) {
      card = capped.review(card, 'easy', card.due).card;
      expect(card.scheduledDays).toBeLessThanOrEqual(3);
    }
    expect(card.scheduledDays).toBe(3);
  });

  it('gives longer intervals at lower desired retention', () => {
    const card = graduate();
    const low = createScheduler({ desiredRetention: 0.8 }).review(card, 'good', card.due).card;
    const high = createScheduler({ desiredRetention: 0.95 }).review(card, 'good', card.due).card;
    expect(low.scheduledDays).toBeGreaterThan(high.scheduledDays);
  });

  it('rejects a review time before the last review', () => {
    const { card } = scheduler.review(scheduler.newCard(T0), 'good', T0);
    expect(() => scheduler.review(card, 'good', at(T0, -MINUTE))).toThrow(RangeError);
    expect(() => scheduler.review(card, 'good', new Date(Number.NaN))).toThrow(RangeError);
  });
});
