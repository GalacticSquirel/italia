import { describe, expect, it } from 'vitest';

import type { PosDistribution } from './frequency';
import { parseMorphIt } from './lexicon';
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

describe('number words', () => {
  const lexicon = parseMorphIt(
    [
      'sei\tessere\tAUX:ind+pres+2+s',
      'sei\tsei\tDET-NUM-CARD',
      'cinque\tcinque\tDET-NUM-CARD',
      'o\to\tCON',
      'alle\talla\tARTPRE-F:p',
      'anni\tanno\tNOUN-M:p',
      'stanco\tstanco\tADJ:pos+m+s',
      'tu\ttu\tPRO-PERS-2-M-S',
    ].join('\n'),
  );
  // SUBTLEX-IT tags most "sei" as a numeral (ADJ); the context must still win.
  const counts = new Map([['sei', dist({ VER: 100, ADJ: 900 })]]);
  const sei = (sentence: string) =>
    tagSentence(sentence, lexicon, counts).find((t) => t.lower === 'sei')?.reading?.units[0]?.lemma;

  it('reads "sei" as six after an article or a number, or before a noun', () => {
    expect(sei('alle sei')).toBe('sei');
    expect(sei('cinque o sei')).toBe('sei');
    expect(sei('sei anni')).toBe('sei');
  });

  it('keeps the verb elsewhere', () => {
    expect(sei('tu sei stanco')).toBe('essere');
    expect(sei('sei stanco')).toBe('essere');
  });
});
