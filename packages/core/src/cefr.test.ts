import { describe, expect, it } from 'vitest';

import {
  CEFR_LEMMA_THRESHOLDS,
  CEFR_LEVELS,
  estimateCefr,
  projectHoursToNextLevel,
  type CefrEstimateLevel,
} from './index';

describe('CEFR_LEMMA_THRESHOLDS', () => {
  it('increases with level', () => {
    for (let i = 1; i < CEFR_LEVELS.length; i++) {
      const prev = CEFR_LEVELS[i - 1];
      const level = CEFR_LEVELS[i];
      if (prev === undefined || level === undefined) throw new Error('unreachable');
      expect(CEFR_LEMMA_THRESHOLDS[level]).toBeGreaterThan(CEFR_LEMMA_THRESHOLDS[prev]);
    }
  });
});

describe('estimateCefr from vocabulary', () => {
  it.each<[number, CefrEstimateLevel]>([
    [0, 'pre-A1'],
    [999, 'pre-A1'],
    [1000, 'A1'],
    [2499, 'A1'],
    [2500, 'A2'],
    [5000, 'B1'],
    [8000, 'B2'],
    [10_000, 'C1'],
    [20_000, 'C2'],
  ])('%i known lemmas is %s', (knownLemmas, level) => {
    expect(estimateCefr({ knownLemmas, unlockedGrammarIds: [] }).level).toBe(level);
  });

  it('reports the next level and the lemmas needed for it', () => {
    const estimate = estimateCefr({ knownLemmas: 1800, unlockedGrammarIds: [] });
    expect(estimate.nextLevel).toBe('A2');
    expect(estimate.nextLevelLemmas).toBe(2500);
    expect(estimate.lemmasToNextLevel).toBe(700);
    const top = estimateCefr({ knownLemmas: 50_000, unlockedGrammarIds: [] });
    expect(top.nextLevel).toBeNull();
    expect(top.lemmasToNextLevel).toBe(0);
  });

  it('widens the range upward when close to the next threshold', () => {
    expect(estimateCefr({ knownLemmas: 2400, unlockedGrammarIds: [] }).range).toEqual({
      low: 'A1',
      high: 'A2',
    });
    expect(estimateCefr({ knownLemmas: 1200, unlockedGrammarIds: [] }).range).toEqual({
      low: 'A1',
      high: 'A1',
    });
  });

  it('has low confidence from vocabulary alone', () => {
    expect(estimateCefr({ knownLemmas: 3000, unlockedGrammarIds: [] }).confidence).toBe('low');
  });

  it('rejects a negative count', () => {
    expect(() => estimateCefr({ knownLemmas: -1, unlockedGrammarIds: [] })).toThrow(RangeError);
  });
});

describe('estimateCefr with grammar and speaking', () => {
  const grammarRequirements = { A1: [1, 2, 3], A2: [4, 5], B1: [6] };

  it('holds the level back until the grammar for it is unlocked', () => {
    const held = estimateCefr({
      knownLemmas: 6000,
      unlockedGrammarIds: [1, 2, 3],
      grammarRequirements,
    });
    expect(held.level).toBe('A1');
    expect(held.range).toEqual({ low: 'A1', high: 'B1' });

    const full = estimateCefr({
      knownLemmas: 6000,
      unlockedGrammarIds: [1, 2, 3, 4, 5, 6],
      grammarRequirements,
    });
    expect(full.level).toBe('B1');
    expect(full.confidence).toBe('medium');
  });

  it('lowers the low end of the range when speaking lags', () => {
    const estimate = estimateCefr({
      knownLemmas: 6000,
      unlockedGrammarIds: [1, 2, 3, 4, 5, 6],
      grammarRequirements,
      speakingScore: 0.2,
    });
    expect(estimate.level).toBe('B1');
    expect(estimate.range).toEqual({ low: 'A2', high: 'B1' });
  });

  it('has high confidence when every signal agrees', () => {
    const estimate = estimateCefr({
      knownLemmas: 6000,
      unlockedGrammarIds: [1, 2, 3, 4, 5, 6],
      grammarRequirements,
      speakingScore: 0.8,
    });
    expect(estimate.confidence).toBe('high');
  });

  it('rejects a speaking score outside 0 to 1', () => {
    expect(() =>
      estimateCefr({ knownLemmas: 10, unlockedGrammarIds: [], speakingScore: 1.5 }),
    ).toThrow(RangeError);
  });
});

describe('projectHoursToNextLevel', () => {
  it('divides the lemmas still needed by the observed rate', () => {
    const projection = projectHoursToNextLevel({
      knownLemmas: 1800,
      observedHours: 20,
      observedLemmasGained: 140,
    });
    expect(projection).toEqual({ nextLevel: 'A2', lemmasNeeded: 700, hours: 100 });
  });

  it('returns null without enough data or progress', () => {
    expect(
      projectHoursToNextLevel({ knownLemmas: 100, observedHours: 0.5, observedLemmasGained: 50 }),
    ).toBeNull();
    expect(
      projectHoursToNextLevel({ knownLemmas: 100, observedHours: 10, observedLemmasGained: 0 }),
    ).toBeNull();
    expect(
      projectHoursToNextLevel({
        knownLemmas: 50_000,
        observedHours: 10,
        observedLemmasGained: 10,
      }),
    ).toBeNull();
  });
});
