import { describe, expect, it } from 'vitest';

import {
  applyFormReadings,
  dropReadings,
  lookup,
  normaliseRow,
  parseMorphIt,
  parseUnitKey,
  readingKey,
  splitClitics,
  unitKey,
} from './lexicon';
import { testLexicon } from './test-lexicon';

const keys = (form: string) => (lookup(testLexicon(), form) ?? []).map(readingKey).sort();

describe('normaliseRow', () => {
  it('maps every definite article form to il and indefinite to un', () => {
    expect(normaliseRow('la', 'la', 'ART-F:s')?.units).toEqual([{ lemma: 'il', upos: 'DET' }]);
    expect(normaliseRow('gli', 'il', 'ART-M:p')?.units).toEqual([{ lemma: 'il', upos: 'DET' }]);
    expect(normaliseRow("un'", "un'", 'ART-F:s')?.units).toEqual([{ lemma: 'un', upos: 'DET' }]);
  });

  it('splits articulated prepositions and partitives', () => {
    expect(normaliseRow('nel', 'nel', 'ARTPRE-M:s')?.units.map(unitKey)).toEqual([
      'in|ADP',
      'il|DET',
    ]);
    expect(normaliseRow('sugli', 'sul', 'ARTPRE-M:p')?.units.map(unitKey)).toEqual([
      'su|ADP',
      'il|DET',
    ]);
    expect(normaliseRow('dei', 'del', 'ART-M:p')?.units.map(unitKey)).toEqual(['di|ADP', 'il|DET']);
  });

  it('maps verbs with enclitics to verb + clitic units', () => {
    expect(normaliseRow('mangiarlo', 'mangiare', 'VER:inf+pres+lo')?.units.map(unitKey)).toEqual([
      'mangiare|VERB',
      'lo|PRON',
    ]);
    expect(normaliseRow('dimmi', 'dimmi', 'VER:impr+pres+2+s+mi')?.units.map(unitKey)).toEqual([
      'dire|VERB',
      'mi|PRON',
    ]);
  });

  it('normalises clitics and auxiliaries', () => {
    expect(normaliseRow("l'", "l'", 'PRO-PERS-CLI-3-F-S')?.units).toEqual([
      { lemma: 'la', upos: 'PRON' },
    ]);
    expect(normaliseRow("c'", "c'", 'ADV')?.units).toEqual([{ lemma: 'ci', upos: 'PRON' }]);
    expect(normaliseRow('glielo', 'glielo', 'PRO-PERS-CLI-COM')?.units.map(unitKey)).toEqual([
      'gli|PRON',
      'lo|PRON',
    ]);
    expect(normaliseRow('è', 'essere', 'AUX:ind+pres+3+s')?.units).toEqual([
      { lemma: 'essere', upos: 'VERB' },
    ]);
    expect(normaliseRow('!', '!', 'SENT')).toBeNull();
  });

  it('records noun gender', () => {
    expect(normaliseRow('casa', 'casa', 'NOUN-F:s')?.gender).toBe('f');
    expect(normaliseRow('libro', 'libro', 'NOUN-M:s')?.gender).toBe('m');
  });
});

describe('splitClitics', () => {
  it('splits clusters into canonical clitics', () => {
    expect(splitClitics('melo')).toEqual(['mi', 'lo']);
    expect(splitClitics('gliene')).toEqual(['gli', 'ne']);
    expect(splitClitics('xyz')).toBeNull();
  });
});

describe('parseMorphIt and lookup', () => {
  it('merges rows with the same units into one reading', () => {
    const [reading] = lookup(testLexicon(), 'sono') ?? [];
    expect(reading?.infl).toEqual(['ind+pres+1+s', 'ind+pres+3+p']);
    expect(reading?.heads).toEqual(['AUX', 'VER']);
  });

  it('keeps ambiguous readings apart', () => {
    expect(keys('porta')).toEqual(['portare|VERB', 'porta|NOUN']);
    expect(keys('la')).toEqual(['il|DET', 'la|PRON']);
  });

  it('accepts unaccented and apostrophe-less spellings', () => {
    expect(keys('po')).toEqual(["po'|PRON"]);
    expect(keys("e'")).toEqual(['essere|VERB']);
    expect(keys('perche')).toEqual(['perché|ADV']);
    expect(lookup(testLexicon(), 'zzz')).toBeUndefined();
  });

  it('reads unlisted enclitic forms as infinitive, gerund or imperative + clitics', () => {
    const units = (form: string) =>
      (lookup(testLexicon(), form) ?? []).map((r) => r.units.map(unitKey).join(' + '));
    expect(units('studiarla')).toEqual(['studiare|VERB + la|PRON']);
    expect(units('dormendoci')).toEqual(['dormire|VERB + ci|PRON']);
    expect(units('portamelo')).toEqual(['portare|VERB + mi|PRON + lo|PRON']);
    expect(lookup(testLexicon(), 'studiarx')).toBeUndefined();
  });

  it('gives inflected pronoun lemmas the determiner lemma', () => {
    const lexicon = parseMorphIt(
      'mia\tmia\tPRO-POSS-F-S\nmia\tmio\tDET-POSS:f+s\nnulla\tnulla\tPRO-INDEF-M-S\nnulla\tnullo\tADJ:pos+f+s',
    );
    expect(lookup(lexicon, 'mia')?.map(readingKey).sort()).toEqual(['mio|DET', 'mio|PRON']);
    // Without a determiner row the pronoun keeps its own lemma.
    expect(lookup(lexicon, 'nulla')?.map(readingKey).sort()).toEqual(['nulla|PRON', 'nullo|ADJ']);
  });

  it('adds the common-word spelling when a form is only a name', () => {
    const lexicon = parseMorphIt("po\tPo\tNPR\npo'\tpo'\tPRO-INDEF-M-S");
    expect(lookup(lexicon, 'po')?.map(readingKey)).toEqual(["po'|PRON", 'Po|PROPN']);
  });

  it('drops readings while keeping at least one per form', () => {
    const lexicon = parseMorphIt(
      'vai\tandare\tVER:ind+pres+2+s\nvai\tvaio\tADJ:pos+m+p\nvaio\tvaio\tADJ:pos+m+s',
    );
    dropReadings(lexicon, new Set(['vaio|ADJ']));
    expect(lookup(lexicon, 'vai')?.map(readingKey)).toEqual(['andare|VERB']);
    expect(lookup(lexicon, 'vaio')?.map(readingKey)).toEqual(['vaio|ADJ']);
  });

  it('applies forced readings', () => {
    const lexicon = testLexicon();
    applyFormReadings(lexicon, { porta: 'portare|VERB', ciao: 'ciao|INTJ' });
    expect(lookup(lexicon, 'porta')?.map(readingKey)).toEqual(['portare|VERB']);
    expect(lookup(lexicon, 'ciao')?.map(readingKey)).toEqual(['ciao|INTJ']);
    expect(() => {
      applyFormReadings(lexicon, { x: 'x|BAD' });
    }).toThrow();
  });

  it('round-trips unit keys', () => {
    expect(parseUnitKey("po'|PRON")).toEqual({ lemma: "po'", upos: 'PRON' });
    expect(() => parseUnitKey('nope')).toThrow();
  });
});
