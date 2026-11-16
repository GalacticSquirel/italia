import { describe, expect, it } from 'vitest';

import { lookup, parseMorphIt } from './lexicon';
import { splitNumeral } from './numerals';

describe('splitNumeral', () => {
  it('splits compounds into basic numbers', () => {
    expect(splitNumeral('ventotto')).toEqual(['venti', 'otto']);
    expect(splitNumeral('ventuno')).toEqual(['venti', 'uno']);
    expect(splitNumeral('trentatré')).toEqual(['trenta', 'tre']);
    expect(splitNumeral('quarantadue')).toEqual(['quaranta', 'due']);
    expect(splitNumeral('duecento')).toEqual(['due', 'cento']);
    expect(splitNumeral('centotto')).toEqual(['cento', 'otto']);
    expect(splitNumeral('centoventi')).toEqual(['cento', 'venti']);
    expect(splitNumeral('novecentonovantanove')).toEqual(['nove', 'cento', 'novanta', 'nove']);
    expect(splitNumeral('millenovecento')).toEqual(['mille', 'nove', 'cento']);
    expect(splitNumeral('duemilasei')).toEqual(['due', 'mille', 'sei']);
    expect(splitNumeral('Duemila')).toEqual(['due', 'mille']);
  });

  it('leaves basic numbers and other words alone', () => {
    for (const w of [
      'venti',
      'cento',
      'mille',
      'tre',
      'diciotto',
      'tré',
      'quarantena',
      'centrale',
    ]) {
      expect(splitNumeral(w)).toBeNull();
    }
    expect(splitNumeral('ventidieci')).toBeNull();
    expect(splitNumeral('unocento')).toBeNull();
    expect(splitNumeral('unomila')).toBeNull();
  });
});

describe('numerals in the lexicon', () => {
  it('reads listed and unlisted compounds as their parts', () => {
    const lexicon = parseMorphIt('trentuno\ttrentuno\tDET-NUM-CARD\nventi\tventi\tDET-NUM-CARD');
    expect(lookup(lexicon, 'trentuno')?.[0]?.units).toEqual([
      { lemma: 'trenta', upos: 'NUM' },
      { lemma: 'uno', upos: 'NUM' },
    ]);
    expect(lookup(lexicon, 'venti')?.[0]?.units).toEqual([{ lemma: 'venti', upos: 'NUM' }]);
    expect(lookup(lexicon, 'ventitré')?.[0]?.units).toEqual([
      { lemma: 'venti', upos: 'NUM' },
      { lemma: 'tre', upos: 'NUM' },
    ]);
  });
});
