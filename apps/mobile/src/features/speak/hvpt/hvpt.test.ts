import { createRng } from '@italia/core';

import {
  answerTrial,
  INITIAL_HVPT_STATS,
  nextTrial,
  parseHvptStats,
  setKey,
  setsForLevel,
  type HvptStats,
  type HvptTrial,
} from './hvpt';

const wrongChoice = (t: HvptTrial) => t.options.find((o) => o !== t.target) ?? t.target;

describe('setsForLevel', () => {
  it('starts with pure length contrasts and widens with level', () => {
    const l1 = setsForLevel(1);
    expect(l1.every((s) => s.contrast === 'geminate' && s.alsoDiffers.length === 0)).toBe(true);
    const l2 = setsForLevel(2);
    expect(l2.some((s) => s.contrast === 'stress')).toBe(true);
    expect(l2.some((s) => s.contrast === 'midVowel')).toBe(false);
    expect(setsForLevel(3).some((s) => s.contrast === 'midVowel')).toBe(true);
    expect(setsForLevel(3, ['geminate', 'stress']).some((s) => s.contrast === 'midVowel')).toBe(
      false,
    );
  });
});

describe('nextTrial', () => {
  it('offers the target and a foil from the same set, rotating talkers', () => {
    const rng = createRng(1);
    let previous: HvptTrial | null = null;
    for (let i = 0; i < 50; i++) {
      const trial: HvptTrial = nextTrial(INITIAL_HVPT_STATS, { rng, talkers: 3, previous });
      expect(trial.options).toContain(trial.target);
      expect(trial.options[0]).not.toBe(trial.options[1]);
      expect(trial.set.items).toEqual(expect.arrayContaining([...trial.options]));
      if (previous) {
        expect(trial.key).not.toBe(previous.key);
        expect(trial.talker).not.toBe(previous.talker);
      }
      expect(trial.talker).toBeLessThan(3);
      previous = trial;
    }
  });

  it('brings up missed contrasts more often', () => {
    const stats: HvptStats = {
      ...INITIAL_HVPT_STATS,
      level: 2,
      byContrast: { geminate: { correct: 40, total: 40 }, stress: { correct: 2, total: 20 } },
    };
    const rng = createRng(7);
    let stress = 0;
    for (let i = 0; i < 400; i++) {
      if (nextTrial(stats, { rng, talkers: 1 }).set.contrast === 'stress') stress++;
    }
    expect(stress / 400).toBeGreaterThan(0.7);
  });
});

describe('answerTrial (staircase)', () => {
  it('moves up after three correct in a row and down after two recent errors', () => {
    const rng = createRng(3);
    let stats = INITIAL_HVPT_STATS;
    for (let i = 0; i < 3; i++) {
      const t = nextTrial(stats, { rng, talkers: 2 });
      const r = answerTrial(stats, t, t.target);
      expect(r.correct).toBe(true);
      stats = r.stats;
    }
    expect(stats.level).toBe(2);
    const t1 = nextTrial(stats, { rng, talkers: 2 });
    stats = answerTrial(stats, t1, wrongChoice(t1)).stats;
    expect(stats.level).toBe(2);
    const t2 = nextTrial(stats, { rng, talkers: 2 });
    const r = answerTrial(stats, t2, wrongChoice(t2));
    expect(r).toMatchObject({ correct: false, levelChange: -1 });
    expect(r.stats.level).toBe(1);
    expect(r.stats.byContrast[t2.set.contrast]?.total).toBeGreaterThan(0);
    expect(r.stats.bySet[setKey(t2.set)]?.correct).toBe(0);
  });

  it('never goes below level 1 or above level 3', () => {
    const rng = createRng(5);
    let stats: HvptStats = { ...INITIAL_HVPT_STATS, level: 3, streak: 5 };
    const t = nextTrial(stats, { rng, talkers: 1 });
    expect(answerTrial(stats, t, t.target).stats.level).toBe(3);
    stats = { ...INITIAL_HVPT_STATS, recent: [false] };
    const t2 = nextTrial(stats, { rng, talkers: 1 });
    expect(answerTrial(stats, t2, wrongChoice(t2)).stats.level).toBe(1);
  });
});

describe('parseHvptStats', () => {
  it('round-trips and tolerates bad input', () => {
    const stats: HvptStats = { ...INITIAL_HVPT_STATS, level: 2, streak: 1, recent: [true] };
    expect(parseHvptStats(JSON.stringify(stats))).toEqual(stats);
    expect(parseHvptStats(null)).toEqual(INITIAL_HVPT_STATS);
    expect(parseHvptStats('{oops')).toEqual(INITIAL_HVPT_STATS);
    expect(parseHvptStats('{"level":9}').level).toBe(1);
  });
});
