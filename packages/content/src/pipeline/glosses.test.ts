import { describe, expect, it } from 'vitest';

import { glossItems, pickGloss, type WiktionaryEntry } from './glosses';
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
