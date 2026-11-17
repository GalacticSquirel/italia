import { describe, expect, it } from 'vitest';

import { CARD_KINDS, CARD_STATES, PROMPT_MODES, RATINGS } from './index';

describe('enumerations', () => {
  it('lists ratings from worst to best', () => {
    expect(RATINGS).toEqual(['again', 'hard', 'good', 'easy']);
  });

  it('has no duplicates', () => {
    for (const values of [RATINGS, CARD_STATES, CARD_KINDS, PROMPT_MODES]) {
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it('includes every card kind from the plan', () => {
    expect(CARD_KINDS).toContain('minimal_pair');
    expect(CARD_KINDS).toHaveLength(7);
  });
});
