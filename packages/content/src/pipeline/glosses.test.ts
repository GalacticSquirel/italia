import { describe, expect, it } from 'vitest';

import { glossItems, pickGloss, variantOf, type WiktionaryEntry } from './glosses';
import { lemmaId } from './ids';

describe('glossItems', () => {
  it('drops parentheses, usage notes and form-of glosses', () => {
    expect(glossItems('nice, fair (of the weather, etc.); beautiful')).toEqual([
      'nice',
      'fair',
      'beautiful',
    ]);
    expect(glossItems("to utter (produce (speech) with one's voice)")).toEqual(['to utter']);
    expect(glossItems('plural of casa')).toEqual([]);
    expect(glossItems('Used as a copula. to be')).toEqual([]);
    expect(glossItems('synonym of ci: us, to us')).toEqual(['us', 'to us']);
  });
});

describe('pickGloss', () => {
  const casa: WiktionaryEntry[] = [
    { word: 'casa', pos: 'noun', senses: [{ glosses: ['plural of casa'], tags: ['form-of'] }] },
    {
      word: 'casa',
      pos: 'noun',
      senses: [{ glosses: ['house'] }, { glosses: ['home'] }, { glosses: ['family, dynasty'] }],
    },
    { word: 'casa', pos: 'verb', senses: [{ glosses: ['to house'], tags: ['obsolete'] }] },
  ];

  it('uses the entries for the matching part of speech', () => {
    expect(pickGloss(casa, 'NOUN')).toEqual({ gloss: 'house, home, family', offensive: false });
    expect(pickGloss(casa, 'VERB')).toBeNull();
  });

  it('ignores a register tag that every sense carries', () => {
    const gente: WiktionaryEntry[] = [
      {
        word: 'gente',
        pos: 'noun',
        senses: [
          { glosses: ['gens'], tags: ['archaic', 'historical'] },
          { glosses: ['people, folks'], tags: ['archaic', 'collective'] },
        ],
      },
    ];
    expect(pickGloss(gente, 'NOUN')?.gloss).toBe('people, folks');
  });

  it('keeps the meaning after a pointer sense colon', () => {
    const cui: WiktionaryEntry[] = [
      {
        word: 'cui',
        pos: 'pron',
        senses: [{ glosses: ['dative of che: to whom, which'], tags: ['form-of'] }],
      },
    ];
    expect(pickGloss(cui, 'PRON')?.gloss).toBe('to whom, which');
  });

  it('flags mostly offensive senses', () => {
    const entries: WiktionaryEntry[] = [
      { word: 'x', pos: 'noun', senses: [{ glosses: ['bad word'], tags: ['vulgar'] }] },
    ];
    expect(pickGloss(entries, 'NOUN')?.offensive).toBe(true);
  });
});

describe('lemmaId', () => {
  it('is a stable positive 31-bit integer that depends on lemma and POS', () => {
    const id = lemmaId('casa', 'NOUN');
    expect(id).toBe(lemmaId('casa', 'NOUN'));
    expect(id).toBeGreaterThan(0);
    expect(id).toBeLessThanOrEqual(0x7fffffff);
    expect(lemmaId('casa', 'VERB')).not.toBe(id);
  });
});

describe('variantOf', () => {
  it('finds the base word of apocopic and euphonic spellings', () => {
    const buon: WiktionaryEntry[] = [
      {
        word: 'buon',
        pos: 'adj',
        senses: [
          {
            glosses: ['apocopic form of buono'],
            tags: ['form-of', 'apocopic'],
            form_of: [{ word: 'buono' }],
          },
        ],
      },
    ];
    expect(variantOf(buon, ['adj'])).toBe('buono');
    const ed: WiktionaryEntry[] = [
      {
        word: 'ed',
        pos: 'conj',
        senses: [
          {
            glosses: ['alternative form of e for euphony; and'],
            tags: ['alt-of', 'alternative'],
            alt_of: [{ word: 'e for euphony' }],
          },
        ],
      },
    ];
    expect(variantOf(ed, ['conj'])).toBe('e');
    const bel: WiktionaryEntry[] = [
      { word: 'bel', pos: 'adj', senses: [{ glosses: ['preconsonantal form of bello'] }] },
    ];
    expect(variantOf(bel, ['adj'])).toBe('bello');
  });

  it('returns null when any entry has a meaning of its own', () => {
    const entries: WiktionaryEntry[] = [
      { word: 'po', pos: 'noun', senses: [{ glosses: ['chamber pot'] }] },
      { word: 'po', pos: 'adv', senses: [{ glosses: ['apocopic form of poco'] }] },
    ];
    expect(variantOf(entries, ['adv'])).toBeNull();
  });
});
