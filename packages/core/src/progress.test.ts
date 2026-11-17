import { describe, expect, it } from 'vitest';

import {
  coverage,
  createScheduler,
  DEFAULT_COVERAGE_WINDOW,
  isKnown,
  knownLemmaCount,
  knownLemmaIds,
  storyFits,
  type CardSchedule,
  type CoverageToken,
} from './index';

const NOW = new Date('2026-05-01T12:00:00.000Z');
const DAY = 86_400_000;

function schedule(stability: number, daysSinceReview: number): CardSchedule {
  return {
    due: new Date(NOW.getTime() + DAY),
    stability,
    difficulty: 5,
    scheduledDays: Math.round(stability),
    learningSteps: 0,
    reps: 5,
    lapses: 0,
    state: 'review',
    lastReview: new Date(NOW.getTime() - daysSinceReview * DAY),
  };
}

describe('isKnown', () => {
  it('needs retrievability of at least 0.9 and stability of at least 7 days', () => {
    expect(isKnown(schedule(10, 1), NOW)).toBe(true);
    // Stability too low.
    expect(isKnown(schedule(6, 0), NOW)).toBe(false);
    // Retrievability below 0.9 once more than one stability interval has passed.
    expect(isKnown(schedule(10, 12), NOW)).toBe(false);
    // Exactly at the thresholds.
    expect(isKnown(schedule(7, 7), NOW)).toBe(true);
  });

  it('is false for a card never reviewed', () => {
    expect(isKnown(createScheduler().newCard(NOW), NOW)).toBe(false);
  });

  it('accepts custom thresholds', () => {
    expect(isKnown(schedule(6, 0), NOW, { minStabilityDays: 5 })).toBe(true);
    expect(isKnown(schedule(10, 1), NOW, { minRetrievability: 0.995 })).toBe(false);
    expect(() => isKnown(schedule(10, 1), NOW, { minRetrievability: 1.5 })).toThrow(RangeError);
  });
});

describe('knownLemmaIds', () => {
  it('counts each lemma once when any of its cards is known', () => {
    const cards = [
      { lemmaIds: [1, 2], schedule: schedule(10, 1) },
      { lemmaIds: [2], schedule: schedule(2, 1) },
      { lemmaIds: [3], schedule: schedule(2, 1) },
      { lemmaIds: [1], schedule: schedule(20, 1) },
    ];
    expect([...knownLemmaIds(cards, NOW)].sort()).toEqual([1, 2]);
    expect(knownLemmaCount(cards, NOW)).toBe(2);
  });
});

describe('coverage', () => {
  const tokens: CoverageToken[] = [
    { lemmaId: 1 },
    { lemmaId: 2 },
    { lemmaId: null }, // punctuation or number
    { lemmaId: 3, properNoun: true },
    { lemmaId: 4 },
    { lemmaId: 1 },
    { lemmaId: 5 },
  ];
  const known = new Set([1, 2]);

  it('is known content tokens over content tokens, excluding proper nouns by default', () => {
    const result = coverage(tokens, known);
    expect(result.countedTokens).toBe(5);
    expect(result.knownTokens).toBe(3);
    expect(result.ratio).toBeCloseTo(3 / 5);
    expect(result.unknownLemmaIds).toEqual([4, 5]);
  });

  it('can count proper nouns', () => {
    const result = coverage(tokens, known, { excludeProperNouns: false });
    expect(result.countedTokens).toBe(6);
    expect(result.unknownLemmaIds).toEqual([3, 4, 5]);
  });

  it('excludes flagged cognates', () => {
    const result = coverage(tokens, known, { cognates: new Set([5]) });
    expect(result.countedTokens).toBe(4);
    expect(result.ratio).toBeCloseTo(3 / 4);
  });

  it('is 1 for a text with no content tokens', () => {
    expect(coverage([{ lemmaId: null }], known).ratio).toBe(1);
  });
});

describe('storyFits', () => {
  it('accepts coverage within 95 to 98% inclusive by default', () => {
    expect(DEFAULT_COVERAGE_WINDOW).toEqual([0.95, 0.98]);
    expect(storyFits(0.95)).toBe(true);
    expect(storyFits(0.97)).toBe(true);
    expect(storyFits(0.98)).toBe(true);
    expect(storyFits(0.949)).toBe(false);
    expect(storyFits(0.99)).toBe(false);
    expect(storyFits(0.9, [0.85, 0.92])).toBe(true);
  });

  it('rejects an inverted window', () => {
    expect(() => storyFits(0.9, [0.98, 0.95])).toThrow(RangeError);
  });
});
