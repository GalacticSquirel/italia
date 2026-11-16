import { describe, expect, it } from 'vitest';

import { BAND_RULES, bandRules, STORY_BANDS } from './bands';
import { GRAMMAR_POINTS } from '../grammar/points';

const slugAt = (order: number) => GRAMMAR_POINTS[order - 1]?.slug;

describe('band rules', () => {
  it('chains the bands and grows the limits with the band', () => {
    let previous = 0;
    let last = BAND_RULES[150];
    for (const band of STORY_BANDS) {
      const rules = bandRules(band);
      expect(rules.previous).toBe(previous);
      expect(rules.next).toBe(STORY_BANDS[STORY_BANDS.indexOf(band) + 1] ?? band);
      expect(rules.maxGrammarOrder).toBeGreaterThanOrEqual(last.maxGrammarOrder);
      expect(rules.words[0]).toBeGreaterThanOrEqual(last.words[0]);
      expect(rules.maxSentenceWords).toBeGreaterThanOrEqual(last.maxSentenceWords);
      expect(rules.words[0]).toBeGreaterThanOrEqual(80);
      expect(rules.words[1]).toBeLessThanOrEqual(350);
      previous = band;
      last = rules;
    }
  });

  it('keeps passato prossimo, imperfetto and the future in their bands', () => {
    expect(slugAt(BAND_RULES[300].maxGrammarOrder)).toBe('piacere');
    expect(slugAt(BAND_RULES[500].maxGrammarOrder)).toBe('passato-prossimo-essere');
    expect(slugAt(BAND_RULES[750].maxGrammarOrder)).toBe('indirect-object-pronouns');
    expect(slugAt(BAND_RULES[1000].maxGrammarOrder)).toBe('passato-prossimo-vs-imperfetto');
    expect(slugAt(BAND_RULES[1500].maxGrammarOrder)).toBe('comparatives');
    expect(slugAt(BAND_RULES[2000].maxGrammarOrder)).toBe('infinitive-past');
    expect(slugAt(BAND_RULES[3000].maxGrammarOrder)).toBe('subjunctive-past');
    // Every band up to B1 stays within A1 to B1 grammar.
    for (const rules of Object.values(BAND_RULES)) {
      const point = GRAMMAR_POINTS[rules.maxGrammarOrder - 1];
      expect(['A1', 'A2', 'B1']).toContain(point?.cefr);
    }
  });

  it('maps bands to CEFR levels and rejects unknown bands', () => {
    expect(STORY_BANDS.map((b) => BAND_RULES[b].level)).toEqual([
      'A1',
      'A1',
      'A1',
      'A2',
      'A2',
      'A2',
      'B1',
      'B1',
    ]);
    expect(() => bandRules(400)).toThrow(/Unknown story band/);
  });
});
