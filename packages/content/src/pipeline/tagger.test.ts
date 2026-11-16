import { describe, expect, it } from 'vitest';

import type { PosDistribution } from './frequency';
import { tagSentence } from './tagger';
import { testLexicon } from './test-lexicon';

/** SUBTLEX-IT counts with "la" and "l'" overwhelmingly articles, as in the real corpus. */
const dist = (byClass: Record<string, number>): PosDistribution => {
  const m = new Map(Object.entries(byClass));
  let total = 0;
  for (const n of m.values()) total += n;
  return { byClass: m, byClassLemma: new Map(), total };
};
const subtlex = new Map<string, PosDistribution>([
  ['la', dist({ DET: 950, PRO: 50 })],
  ["l'", dist({ DET: 950, PRO: 50 })],
]);

const posOf = (sentence: string, word: string) => {
  const token = tagSentence(sentence, testLexicon(), subtlex).find((t) => t.lower === word);
  const unit = token?.reading?.units[0];
  return unit ? `${unit.lemma}/${unit.upos}` : null;
};

describe('tagSentence: article or clitic pronoun', () => {
  it('reads "la" before a verb as a pronoun', () => {
    expect(posOf('Non la mangio.', 'la')).toMatch(/\/PRON$/);
    expect(posOf('Io la mangerò.', 'la')).toMatch(/\/PRON$/);
  });

  it('reads "l\'" before a verb as a pronoun', () => {
    expect(posOf("Non l'ho mangiato.", "l'")).toMatch(/\/PRON$/);
  });

  it('keeps "la" before a noun as the article', () => {
    expect(posOf('Io mangio la casa.', 'la')).toBe('il/DET');
  });
});
