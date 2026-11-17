import { describe, expect, it } from 'vitest';

import {
  FEATURES,
  isPhoneme,
  normalizePhone,
  PHONEMES,
  recognizedCost,
  substitutionCost,
} from './index';

describe('inventory', () => {
  it('has features for every phoneme and no duplicates', () => {
    expect(new Set(PHONEMES).size).toBe(PHONEMES.length);
    for (const p of PHONEMES) expect(FEATURES[p]).toBeDefined();
    expect(PHONEMES).toHaveLength(33);
  });

  it('uses IPA script g', () => {
    expect(isPhoneme('ɡ')).toBe(true);
    expect(isPhoneme('g')).toBe(false);
  });
});

describe('substitutionCost', () => {
  it('is zero for identity, symmetric and within [0, 1]', () => {
    for (const a of PHONEMES) {
      expect(substitutionCost(a, a)).toBe(0);
      for (const b of PHONEMES) {
        const c = substitutionCost(a, b);
        expect(c).toBe(substitutionCost(b, a));
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
        if (a !== b) expect(c).toBeGreaterThan(0);
      }
    }
  });

  it('ranks phonetically close pairs below distant ones', () => {
    expect(substitutionCost('t', 'd')).toBeLessThan(substitutionCost('t', 'k'));
    expect(substitutionCost('t', 'k')).toBeLessThan(substitutionCost('t', 'm'));
    expect(substitutionCost('e', 'ɛ')).toBeLessThan(substitutionCost('e', 'a'));
    expect(substitutionCost('e', 'E')).toBeLessThan(substitutionCost('e', 'ɛ'));
    expect(substitutionCost('i', 'u')).toBeLessThan(substitutionCost('i', 't'));
    expect(substitutionCost('a', 'p')).toBe(1);
    expect(substitutionCost('n', 'ŋ')).toBe(0.1);
    expect(substitutionCost('j', 'i')).toBe(0.2);
  });

  it('documents a few exact values', () => {
    expect(substitutionCost('t', 'd')).toBe(0.35);
    expect(substitutionCost('s', 'z')).toBe(0.35);
    expect(substitutionCost('e', 'ɛ')).toBe(0.35);
    expect(substitutionCost('o', 'u')).toBe(0.35);
  });
});

describe('normalizePhone', () => {
  it('maps aliases and strips length and aspiration marks', () => {
    expect(normalizePhone('g')).toMatchObject({ symbol: 'ɡ', long: false });
    expect(normalizePhone('tː')).toMatchObject({ symbol: 't', long: true });
    expect(normalizePhone('t:')).toMatchObject({ symbol: 't', long: true });
    expect(normalizePhone('pʰ')).toMatchObject({ symbol: 'p', aspirated: true });
    expect(normalizePhone('ʧ').symbol).toBe('tʃ');
    expect(normalizePhone('t͡s').symbol).toBe('ts');
    expect(normalizePhone('ɾ').symbol).toBe('r');
    expect(normalizePhone('ei').symbol).toBe('eɪ');
  });

  it('drops silence and keeps foreign symbols', () => {
    expect(normalizePhone('<pad>').symbol).toBeNull();
    expect(normalizePhone('SIL').symbol).toBeNull();
    expect(normalizePhone('ə')).toMatchObject({ symbol: 'ə', unknown: false });
    expect(normalizePhone('ʁ')).toMatchObject({ symbol: 'ʁ', unknown: true });
  });
});

describe('recognizedCost', () => {
  it('costs foreign symbols against their nearest phoneme', () => {
    expect(recognizedCost('e', 'eɪ')).toBeLessThan(0.5);
    expect(recognizedCost('r', 'ɹ')).toBe(0.2);
    expect(recognizedCost('e', 'ə')).toBeLessThan(recognizedCost('e', 't'));
    expect(recognizedCost('e', 'ʁ')).toBe(1);
  });
});
