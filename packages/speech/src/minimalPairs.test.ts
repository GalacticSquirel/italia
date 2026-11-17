import { describe, expect, it } from 'vitest';

import { g2p, MINIMAL_PAIRS, minimalPairsFor, type Phoneme, type WordG2P } from './index';

function word(text: string): WordG2P {
  const w = g2p(text).words[0];
  if (!w) throw new Error(`no word for ${text}`);
  return w;
}

/** Collapse differences a geminate pair may legitimately also have. */
function neutral(p: Phoneme): string {
  if (p === 'e' || p === 'ɛ' || p === 'E') return 'E';
  if (p === 'o' || p === 'ɔ' || p === 'O') return 'O';
  if (p === 's' || p === 'z') return 'S';
  return p;
}

describe('MINIMAL_PAIRS', () => {
  it('has at least 40 geminate pairs and some mid-vowel and stress sets', () => {
    expect(minimalPairsFor('geminate').length).toBeGreaterThanOrEqual(40);
    expect(minimalPairsFor('midVowel').length).toBeGreaterThanOrEqual(8);
    expect(minimalPairsFor('stress').length).toBeGreaterThanOrEqual(10);
  });

  it('has glosses for every item and no duplicate sets', () => {
    const keys = new Set<string>();
    for (const set of MINIMAL_PAIRS) {
      expect(set.items.length).toBeGreaterThanOrEqual(2);
      for (const item of set.items) expect(item.gloss.length).toBeGreaterThan(0);
      const key = `${set.contrast}:${set.items.map((i) => i.accented).join('/')}`;
      expect(keys.has(key), key).toBe(false);
      keys.add(key);
    }
  });

  it('marks every mid-vowel pair as regionally variable', () => {
    for (const set of minimalPairsFor('midVowel')) expect(set.regionalVariance).toBe(true);
  });

  describe('geminate pairs differ only in the length of one consonant', () => {
    for (const set of minimalPairsFor('geminate')) {
      const [a, b] = set.items;
      if (!a || !b) continue;
      it(`${a.word} / ${b.word}`, () => {
        const wa = word(a.accented);
        const wb = word(b.accented);
        expect(wa.phonemes.map((p) => neutral(p.phoneme))).toEqual(
          wb.phonemes.map((p) => neutral(p.phoneme)),
        );
        const diffs = wa.phonemes.flatMap((p, i) =>
          p.isLong !== wb.phonemes[i]?.isLong ? [i] : [],
        );
        expect(diffs).toHaveLength(1);
        const i = diffs[0] ?? -1;
        expect(wa.phonemes[i]?.isLong).toBe(false);
        expect(wb.phonemes[i]?.isLong).toBe(true);
        expect(wa.stressedSyllable).toBe(wa.syllables.length - 2);
        expect(wb.stressedSyllable).toBe(wa.stressedSyllable);
      });
    }
  });

  describe('mid-vowel pairs differ only in the openness of the stressed vowel', () => {
    for (const set of minimalPairsFor('midVowel')) {
      const [open, close] = set.items;
      if (!open || !close) continue;
      it(`${open.accented} / ${close.accented}`, () => {
        expect(open.word).toBe(close.word);
        const wo = word(open.accented);
        const wc = word(close.accented);
        const diffs = wo.phonemes.flatMap((p, i) =>
          p.phoneme !== wc.phonemes[i]?.phoneme ? [i] : [],
        );
        expect(diffs).toHaveLength(1);
        const i = diffs[0] ?? -1;
        expect(['ɛ', 'ɔ']).toContain(wo.phonemes[i]?.phoneme);
        expect(['e', 'o']).toContain(wc.phonemes[i]?.phoneme);
        expect(wo.phonemes[i]?.stressed).toBe(true);
      });
    }
  });

  describe('stress sets put the stress on different syllables', () => {
    for (const set of minimalPairsFor('stress')) {
      it(set.items.map((i) => i.accented).join(' / '), () => {
        const stressedVowel = set.items.map((item) => {
          const w = word(item.accented);
          const p = w.phonemes.find((t) => t.stressed);
          return p?.span.start;
        });
        expect(new Set(stressedVowel).size).toBe(set.items.length);
        const plain = set.items.map((i) =>
          i.word.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC'),
        );
        expect(new Set(plain).size).toBe(1);
      });
    }
  });
});
