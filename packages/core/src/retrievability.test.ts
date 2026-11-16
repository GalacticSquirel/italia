import { describe, expect, it } from 'vitest';

import { createScheduler, retrievability } from './index';

const T0 = new Date('2026-01-01T09:00:00.000Z');
const DAY = 86_400_000;

describe('retrievability', () => {
  const scheduler = createScheduler();

  it('is 0 for a card that has never been reviewed', () => {
    expect(retrievability(scheduler.newCard(T0), T0)).toBe(0);
  });

  it('is 1 immediately after a review and 0.9 after one stability interval', () => {
    const { card } = scheduler.review(scheduler.newCard(T0), 'easy', T0);
    expect(retrievability(card, T0)).toBeCloseTo(1, 6);
    const after = new Date(T0.getTime() + card.stability * DAY);
    expect(retrievability(card, after)).toBeCloseTo(0.9, 4);
  });

  it('decreases monotonically with time', () => {
    const { card } = scheduler.review(scheduler.newCard(T0), 'good', T0);
    let previous = 1;
    for (let d = 1; d < 60; d += 3) {
      const r = retrievability(card, new Date(T0.getTime() + d * DAY));
      expect(r).toBeLessThan(previous);
      expect(r).toBeGreaterThan(0);
      previous = r;
    }
  });

  it('treats a time before the last review as no time elapsed', () => {
    const { card } = scheduler.review(scheduler.newCard(T0), 'good', T0);
    expect(retrievability(card, new Date(T0.getTime() - DAY))).toBeCloseTo(1, 6);
  });

  it('rejects an invalid date', () => {
    const { card } = scheduler.review(scheduler.newCard(T0), 'good', T0);
    expect(() => retrievability(card, new Date(Number.NaN))).toThrow(RangeError);
  });
});
