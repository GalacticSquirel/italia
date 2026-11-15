import { describe, expect, it } from 'vitest';

import {
  expectedPhones,
  g2p,
  LEXICON,
  LEXICON_LIST_SIZES,
  stripAnnotation,
  type WordG2P,
} from './index';

function word(text: string): WordG2P {
  const w = g2p(text).words[0];
  if (!w) throw new Error(`no word for ${text}`);
  return w;
}

function spanText(text: string, w: WordG2P, i: number): string {
  const p = w.phonemes[i];
  return p ? g2p(text).text.slice(p.span.start, p.span.end) : '';
}

describe('g2p tokens', () => {
  it('returns phoneme, length, role, syllable and stress for each phone', () => {
    const w = word('fatto');
    expect(w.phonemes.map((p) => p.phoneme)).toEqual(['f', 'a', 't', 'o']);
    expect(w.phonemes.map((p) => p.isLong)).toEqual([false, false, true, false]);
    expect(w.phonemes.map((p) => p.role)).toEqual(['consonant', 'nucleus', 'consonant', 'nucleus']);
    expect(w.phonemes.map((p) => p.stressed)).toEqual([false, true, false, false]);
    expect(w.phonemes.map((p) => p.syllable)).toEqual([0, 0, 0, 1]);
    expect(w.stressedSyllable).toBe(0);
    expect(w.syllables).toHaveLength(2);
    // The long t is in the coda of the first syllable and the onset of the second.
    expect(w.syllables[0]?.phonemes).toEqual([0, 1, 2]);
    expect(w.syllables[1]?.phonemes).toEqual([2, 3]);
  });

  it('gives source spans that include silent letters', () => {
    expect(spanText('ciao', word('ciao'), 0)).toBe('ci');
    expect(spanText('che', word('che'), 0)).toBe('ch');
    expect(spanText('ho', word('ho'), 0)).toBe('ho');
    expect(spanText('figlio', word('figlio'), 2)).toBe('gli');
    expect(spanText('gatto', word('gatto'), 2)).toBe('tt');
    expect(spanText('acqua', word('acqua'), 1)).toBe('cq');
  });

  it('gives syllable spans and IPA', () => {
    const w = word('pasta');
    expect(w.syllables.map((s) => w.text.slice(s.span.start, s.span.end))).toEqual(['pa', 'sta']);
    expect(w.syllables.map((s) => s.ipa)).toEqual(['pa', 'sta']);
    expect(w.syllables.map((s) => s.stressed)).toEqual([true, false]);
  });

  it('keeps spans relative to the whole text for later words', () => {
    const result = g2p('Ciao, Maria!');
    expect(result.words.map((w) => w.text)).toEqual(['Ciao', 'Maria']);
    const maria = result.words[1];
    expect(maria?.span).toEqual({ start: 6, end: 11 });
    expect(maria?.ipa).toBe('ma.ˈri.a');
    expect(result.text.slice(maria?.phonemes[0]?.span.start, maria?.phonemes[0]?.span.end)).toBe(
      'M',
    );
  });

  it('handles upper case and decomposed accents', () => {
    expect(word('CITTÀ').ipa).toBe('tʃit.ˈta');
    expect(word('città').ipa).toBe('tʃit.ˈta');
  });

  it('ignores digits and punctuation', () => {
    expect(g2p('3, 2... via!').words.map((w) => w.text)).toEqual(['via']);
  });
});

describe('g2p flags and alternatives', () => {
  it('flags intervocalic s as variable and accepts /s/', () => {
    const s = word('casa').phonemes[2];
    expect(s?.phoneme).toBe('z');
    expect(s?.alternatives).toEqual(['s']);
    expect(s?.flags).toContain('sVoicingVariable');
  });

  it('does not flag s before consonants, word-initially or doubled', () => {
    for (const text of ['sbaglio', 'pasta', 'sole', 'rosso', 'penso']) {
      expect(word(text).phonemes.some((p) => p.flags.includes('sVoicingVariable'))).toBe(false);
    }
  });

  it('flags unknown z voicing and accepts the other value', () => {
    const z = word('zanna').phonemes[0];
    expect(z?.phoneme).toBe('dz');
    expect(z?.flags).toContain('zVoicingUncertain');
    expect(z?.alternatives).toEqual(['ts']);
    const alzare = word('alzare').phonemes[2];
    expect(alzare?.phoneme).toBe('ts');
    expect(alzare?.flags).toContain('zVoicingUncertain');
  });

  it('does not flag z known from the lexicon or a reliable rule', () => {
    for (const text of ['pizza', 'zero', 'azione', 'senza', 'organizzare']) {
      expect(word(text).phonemes.some((p) => p.flags.includes('zVoicingUncertain'))).toBe(false);
    }
  });

  it('marks unknown stressed mid vowels as archiphonemes accepting both qualities', () => {
    const e = word('pena').phonemes[1];
    expect(e?.phoneme).toBe('E');
    expect(e?.alternatives).toEqual(['e', 'ɛ']);
    expect(e?.flags).toContain('midVowelUnknown');
    expect(e?.midVowelSource).toBe('unknown');
  });

  it('records where mid-vowel quality came from', () => {
    expect(word('caffè').phonemes.at(-1)?.midVowelSource).toBe('accent');
    expect(word('bene').phonemes[1]?.midVowelSource).toBe('lexicon');
    expect(word('buono').phonemes[2]?.midVowelSource).toBe('rule');
    expect(word('buono').phonemes[4]?.midVowelSource).toBe('unstressed');
  });

  it('marks intrinsic geminates', () => {
    for (const [text, index] of [
      ['figlio', 2],
      ['bagno', 2],
      ['pesce', 2],
      ['azione', 1],
    ] as const) {
      const p = word(text).phonemes[index];
      expect(p?.isLong).toBe(true);
      expect(p?.flags).toContain('intrinsicLong');
    }
    // Not word-initially or after a consonant.
    expect(word('gnocchi').phonemes[0]?.isLong).toBe(false);
    expect(word('scena').phonemes[0]?.isLong).toBe(false);
    expect(word('pranzo').phonemes[4]?.isLong).toBe(false);
  });

  it('accepts /n/ for the velar nasal allophone', () => {
    const n = word('banca').phonemes[2];
    expect(n?.phoneme).toBe('ŋ');
    expect(n?.alternatives).toEqual(['n']);
  });

  it('marks off-glides as non-syllabic', () => {
    expect(word('mai').phonemes.map((p) => p.role)).toEqual(['consonant', 'nucleus', 'offGlide']);
    expect(word('mai').syllables).toHaveLength(1);
  });
});

describe('g2p stress', () => {
  it('reports the stress source', () => {
    expect(word('città').stressSource).toBe('accent');
    expect(word('tavolo').stressSource).toBe('lexicon');
    expect(word('bellissimo').stressSource).toBe('rule');
    expect(word('casa').stressSource).toBe('default');
    expect(word('blu').stressSource).toBe('monosyllable');
    expect(word('il').stressSource).toBe('unstressed');
    expect(word('il').stressedSyllable).toBeNull();
  });

  it('lets a written accent override the lexicon', () => {
    expect(word('àncora').stressedSyllable).toBe(0);
    expect(word('ancóra').stressedSyllable).toBe(1);
    expect(word('prìncipi').stressedSyllable).toBe(0);
    expect(word('principi').stressedSyllable).toBe(1);
  });

  it('lists the other readings of ambiguous spellings', () => {
    expect(word('ancora').stressAlternatives).toEqual(['àncora']);
    expect(word('pesca').stressAlternatives).toEqual(['pèsca', 'pésca']);
    expect(word('casa').stressAlternatives).toEqual([]);
    // A written accent resolves the ambiguity.
    expect(word('àncora').stressAlternatives).toEqual([]);
  });

  it('stresses a final written accent in oxytones', () => {
    for (const text of ['città', 'perché', 'virtù', 'andò', 'lunedì']) {
      const w = word(text);
      expect(w.stressedSyllable).toBe(w.syllables.length - 1);
    }
  });
});

describe('g2p syntactic doubling', () => {
  const flagged = (text: string): string[] =>
    g2p(text).words.flatMap((w) =>
      w.phonemes[0]?.flags.includes('syntacticDoublingCandidate') ? [w.text] : [],
    );

  it('flags consonants after triggers without lengthening them', () => {
    expect(flagged('vado a Roma')).toEqual(['Roma']);
    expect(flagged('tè e caffè')).toEqual(['caffè']);
    expect(flagged('città bella')).toEqual(['bella']);
    expect(flagged('più forte')).toEqual(['forte']);
    expect(flagged('che cosa')).toEqual(['cosa']);
    expect(flagged('tre cani')).toEqual(['cani']);
    expect(g2p('a Roma').words[1]?.phonemes[0]?.isLong).toBe(false);
  });

  it('does not flag after non-triggers, across punctuation, before vowels or s + consonant', () => {
    expect(flagged('la casa')).toEqual([]);
    expect(flagged('di Roma')).toEqual([]);
    expect(flagged('a, Roma')).toEqual([]);
    expect(flagged('a Ostia')).toEqual([]);
    expect(flagged('a scuola')).toEqual([]);
  });
});

describe('expectedPhones', () => {
  it('flattens words with word and phone indices', () => {
    const phones = expectedPhones(g2p('la pizza'));
    expect(phones.map((p) => p.phoneme).join(' ')).toBe('l a p i ts a');
    expect(phones.map((p) => p.wordIndex)).toEqual([0, 0, 1, 1, 1, 1]);
    expect(phones[4]).toMatchObject({ phoneme: 'ts', isLong: true, phoneIndex: 2 });
  });
});

describe('lexicon', () => {
  const MARKS = /[àèéìòóùêô]/gu;

  it('has around 300 stress entries plus quality and z entries', () => {
    const stress =
      LEXICON_LIST_SIZES.proparoxytones + LEXICON_LIST_SIZES.hiatus + LEXICON_LIST_SIZES.oxytones;
    expect(stress).toBeGreaterThanOrEqual(300);
    expect(LEXICON.size).toBeGreaterThan(400);
  });

  it('marks exactly one stressed vowel in every entry', () => {
    for (const [key, entry] of LEXICON) {
      expect(entry.accented.normalize('NFC').match(MARKS), entry.accented).toHaveLength(1);
      expect(stripAnnotation(entry.accented)).toBe(key);
    }
  });

  it('uses acute and grave on e/o and grave elsewhere', () => {
    for (const entry of LEXICON.values()) {
      expect(entry.accented, entry.accented).not.toMatch(/[áíúâîû]/u);
    }
  });

  it('is applied by the G2P: stress falls on the marked vowel', () => {
    for (const [key, entry] of LEXICON) {
      const w = word(key);
      const stressed = w.phonemes.find((p) => p.stressed);
      const markedAt = entry.accented.normalize('NFC').search(/[àèéìòóùêô]/u);
      expect((stressed?.span.end ?? 0) - 1, key).toBe(markedAt);
      expect(w.stressSource, key).toBe('lexicon');
    }
  });

  it('gives the marked quality to stressed e/o', () => {
    for (const [key, entry] of LEXICON) {
      const acc = entry.accented.normalize('NFC');
      const stressed = word(key).phonemes.find((p) => p.stressed);
      if (/[èò]/u.test(acc)) expect(['ɛ', 'ɔ'], key).toContain(stressed?.phoneme);
      if (/[éó]/u.test(acc)) expect(['e', 'o'], key).toContain(stressed?.phoneme);
    }
  });

  it('carries z values for every z group it lists', () => {
    for (const [key, entry] of LEXICON) {
      if (!entry.z) continue;
      const zs = word(key).phonemes.filter((p) => p.phoneme === 'ts' || p.phoneme === 'dz');
      expect(
        zs.map((p) => p.phoneme),
        key,
      ).toEqual(entry.z);
    }
  });
});
