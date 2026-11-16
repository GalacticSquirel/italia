import { describe, expect, it } from 'vitest';

import {
  errorHistoryFor,
  knownGrammarFor,
  learnerProfileFor,
  lemmaCeilingFor,
  scenariosForLevel,
  tutorLevelFor,
} from './profile';
import { renderSystemPrompt } from './render';
import { GRAMMAR_POINTS, SCENARIOS } from './spec.generated';

describe('learner profile', () => {
  it('maps CEFR estimates onto tutor levels', () => {
    expect(tutorLevelFor('pre-A1')).toBe('A1');
    expect(tutorLevelFor('B1')).toBe('B1');
    expect(tutorLevelFor('C1')).toBe('C1');
    expect(tutorLevelFor('C2')).toBe('C2');
  });

  it('derives the lemma ceiling from known words within the band', () => {
    expect(lemmaCeilingFor('A1', 20)).toBe(300);
    expect(lemmaCeilingFor('A2', 742)).toBe(750);
    expect(lemmaCeilingFor('A2', 5000)).toBeNull();
  });

  it('maps unlocked content grammar ids to slugs at or below the level', () => {
    const a1 = GRAMMAR_POINTS.filter((p) => p.cefr === 'A1' && p.id !== null).slice(0, 2);
    const b1 = GRAMMAR_POINTS.find((p) => p.cefr === 'B1' && p.id !== null);
    const ids = [...a1.map((p) => p.id ?? -1), b1?.id ?? -1, 9999];
    expect(knownGrammarFor('A1', ids)).toEqual(a1.map((p) => p.slug));
  });

  it('keeps recurring taxonomy errors only, most frequent first', () => {
    expect(
      errorHistoryFor([
        { category: 'article-form', count: 2 },
        { category: 'agreement.gender', count: 9 },
        { category: 'auxiliary-choice', count: 5, lastExample: 'ho andato' },
        { category: 'noun-gender', count: 1 },
      ]),
    ).toEqual([
      { tag: 'auxiliary-choice', count: 5, lastExample: 'ho andato' },
      { tag: 'article-form', count: 2, lastExample: null },
    ]);
  });

  it('builds a profile that renders', () => {
    const profile = learnerProfileFor({
      cefr: 'A2',
      knownLemmas: 600,
      unlockedGrammarIds: [1, 2],
      errorCounts: [{ category: 'article-form', count: 3 }],
    });
    expect(profile.level).toBe('A2');
    const scenario = scenariosForLevel(SCENARIOS, 'A2')[0];
    if (!scenario) throw new Error('no A2 scenario');
    const prompt = renderSystemPrompt({ learner: profile, scenario });
    expect(prompt).toContain('600 most common');
    expect(prompt).toContain('article-form, 3x');
  });

  it('offers scenarios for the level, easiest first', () => {
    const a2 = scenariosForLevel(SCENARIOS, 'A2');
    expect(a2.length).toBeGreaterThan(5);
    expect(a2.every((s) => s.levels.includes('A2'))).toBe(true);
    expect(a2[0]?.levels[0]).toBe('A1');
  });
});
