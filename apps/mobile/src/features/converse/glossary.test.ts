import { getContentIndex } from '@/features/study/content';
import { createTestApp, type TestApp } from '@/testing/testApp';

import { lookupWord, splitWords } from './glossary';

let app: TestApp;

beforeEach(async () => {
  app = await createTestApp();
});

afterEach(() => {
  app.t.close();
});

describe('splitWords', () => {
  it('keeps every character and marks the words', () => {
    const pieces = splitWords("Ciao! L'acqua è fredda?");
    expect(pieces.map((p) => p.text).join('')).toBe("Ciao! L'acqua è fredda?");
    expect(pieces.filter((p) => p.word).map((p) => p.text)).toEqual([
      'Ciao',
      "L'acqua",
      'è',
      'fredda',
    ]);
  });
});

describe('lookupWord', () => {
  it('finds a word form through the content tags, then the headword', () => {
    const content = getContentIndex(app.repos);
    expect(lookupWord('Sono', content)).toEqual({
      word: 'Sono',
      lemma: 'essere',
      gloss: 'to be',
      source: 'dictionary',
    });
    expect(lookupWord('casa', content)).toMatchObject({ lemma: 'casa', source: 'dictionary' });
  });

  it("looks past an elided article and falls back to the tutor's glosses", () => {
    const content = getContentIndex(app.repos);
    expect(lookupWord("l'casa", content)).toMatchObject({ lemma: 'casa' });
    expect(lookupWord('cornetto', content, [{ lemma: 'cornetto', glossEn: 'croissant' }])).toEqual({
      word: 'cornetto',
      lemma: 'cornetto',
      gloss: 'croissant',
      source: 'tutor',
    });
    expect(lookupWord('zzz', content)).toBeNull();
  });
});
