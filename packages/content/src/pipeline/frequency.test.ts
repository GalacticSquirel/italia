import { describe, expect, it } from 'vitest';

import {
  countLemmas,
  mergeHomographs,
  parseFrequencyWords,
  parseSubtlex,
  properNounShare,
  readingPriors,
  shadowedLemmas,
  tokenCoverage,
} from './frequency';
import { lookup, parseMorphIt } from './lexicon';
import { testLexicon } from './test-lexicon';

const SUBTLEX = [
  'wordform;freq_count;zipf;cd_count;dom_pos;dom_lemma;dom_lemma_freq;all_pos;all_lemma;all_pos_freq;all_pos_lemma;all_pos_lemma_freq;id',
  'porta;100;1;1;NOM;porta;1;.NOM.VER.;.porta.portare.;.75.25.;.NOM-porta.VER-portare.;.1.1.;1',
  'Roma;50;1;1;NPR;Roma;1;.NPR.;.Roma.;.50.;.NPR-Roma.;.1.;2',
  'detto;100;1;1;VER;dire;1;.VER.VER.;.dire.dettare.;.99.1.;.VER-dire.VER-dettare.;.1.1.;3',
].join('\r\n');

describe('parseSubtlex', () => {
  it('reads class and class-lemma distributions, folding case', () => {
    const dist = parseSubtlex(SUBTLEX);
    expect(dist.get('porta')?.byClass.get('NOM')).toBe(75);
    expect(dist.get('detto')?.byClassLemma.get('VER-dettare')).toBe(1);
    expect(properNounShare(dist.get('roma'))).toBe(1);
  });
});

describe('readingPriors', () => {
  it('splits by SUBTLEX class shares', () => {
    const readings = lookup(testLexicon(), 'porta') ?? [];
    const priors = readingPriors(readings, parseSubtlex(SUBTLEX).get('porta'));
    const noun = readings.findIndex((r) => r.units[0]?.upos === 'NOUN');
    expect(priors[noun]).toBeGreaterThan(0.6);
    expect(priors.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it('splits same-class readings by SUBTLEX lemma counts, else by lemma frequency', () => {
    const lexicon = parseMorphIt(
      'detto\tdire\tVER:part+past+s+m\ndetto\tdettare\tVER:ind+pres+1+s',
    );
    const readings = lookup(lexicon, 'detto') ?? [];
    const withSubtlex = readingPriors(readings, parseSubtlex(SUBTLEX).get('detto'));
    expect(withSubtlex[0]).toBeGreaterThan(0.9);
    const byFrequency = readingPriors(readings, undefined, (k) => (k === 'dire|VERB' ? 1000 : 1));
    expect(byFrequency[0]).toBeGreaterThan(0.99);
  });
});

describe('countLemmas', () => {
  const forms = parseFrequencyWords('è 100\nsono 50\nporta 40\nnel 10\nRoma 5\nxyz 5\n');

  it('counts lemmas, unknown and proper-noun tokens', () => {
    const counted = countLemmas(forms, testLexicon(), parseSubtlex(SUBTLEX));
    expect(counted.counts.get('essere|VERB')).toBe(150);
    expect(counted.counts.get('in|ADP')).toBe(10);
    expect(counted.counts.get('il|DET')).toBe(10);
    expect(counted.totalTokens).toBe(210);
    expect(counted.unknownTokens).toBe(5);
    expect(counted.properNounTokens).toBe(5);
    expect(tokenCoverage(counted, new Set(['essere|VERB']))).toBeCloseTo(150 / 210);
  });

  it('applies a canonical key mapping', () => {
    const counted = countLemmas(forms, testLexicon(), parseSubtlex(SUBTLEX), {
      canonical: (k) => (k === 'porta|NOUN' ? 'portare|VERB' : k),
    });
    expect(counted.counts.get('portare|VERB')).toBeCloseTo(40);
  });
});

describe('mergeHomographs', () => {
  it('merges nominal classes and rare same-spelling lemmas into the main one', () => {
    const canon = mergeHomographs(
      new Map([
        ['amico|NOUN', 100],
        ['amico|ADJ', 60],
        ['ora|ADV', 100],
        ['ora|NOUN', 30],
        ['bene|ADV', 100],
        ['bene|NOUN', 5],
        ['mio|PRON', 100],
        ['mio|DET', 20],
      ]),
      { preferred: { mio: 'DET' } },
    );
    expect(canon('amico|ADJ')).toBe('amico|NOUN');
    expect(canon('ora|NOUN')).toBe('ora|NOUN');
    expect(canon('bene|NOUN')).toBe('bene|ADV');
    expect(canon('mio|PRON')).toBe('mio|DET');
    expect(canon('casa|NOUN')).toBe('casa|NOUN');
  });
});

describe('shadowedLemmas', () => {
  it('flags lemmas whose count comes from another word’s main form', () => {
    const lexicon = parseMorphIt(
      'devi\tdovere\tVER:ind+pres+2+s\ndevi\tdeviare\tVER:ind+pres+2+s\ndevo\tdovere\tVER:ind+pres+1+s',
    );
    const counted = countLemmas(parseFrequencyWords('devi 100\ndevo 100\n'), lexicon, new Map());
    // Re-estimation moves most of "devi" to the frequent verb.
    expect(counted.counts.get('dovere|VERB')).toBeGreaterThan(190);
    const shadowed = shadowedLemmas(counted, new Set(['VERB']));
    expect(shadowed.has('deviare|VERB')).toBe(true);
    expect(shadowed.has('dovere|VERB')).toBe(false);
  });
});
