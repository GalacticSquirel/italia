import { describe, expect, it } from 'vitest';

import { BAND_RULES, type StoryBand } from './bands';
import { type Story, StorySchema, type StorySeries, type StoryToken } from './schema';
import { type StoryLemma } from './tagger';
import { validateCorpus, validateStory } from './validate';
import { GRAMMAR_POINTS } from '../grammar/points';

/** Lemma id = rank, so a token's number is its frequency rank. */
const lemmas = new Map<number, StoryLemma>(
  Array.from({ length: 3000 }, (_, i) => [
    i + 1,
    { id: i + 1, lemma: `w${i + 1}`, pos: 'NOUN', freqRank: i + 1 },
  ]),
);

type Word = number | 'name' | 'unknown';

interface StoryOptions {
  band?: StoryBand;
  perSentence?: number;
  grammarIds?: number[];
  targets?: number[];
}

/** A story whose tokens are the given ranks; sentences are split every `perSentence` words. */
function story(
  words: Word[],
  { band = 150, perSentence = 8, grammarIds = [], targets = [] }: StoryOptions = {},
): Story {
  const sentences = [];
  for (let i = 0; i < words.length; i += perSentence) {
    const chunk = words.slice(i, i + perSentence);
    let it = '';
    const tokens: StoryToken[] = chunk.map((w, j) => {
      const text = w === 'name' ? 'Sara' : w === 'unknown' ? 'boh' : `w${w}`;
      const start = it.length;
      it += `${j > 0 ? ' ' : ''}${text}`;
      const begin = j > 0 ? start + 1 : start;
      const base = { text, start: begin, end: begin + text.length };
      if (w === 'name') return { ...base, lemmaId: null, isName: true as const };
      if (w === 'unknown') return { ...base, lemmaId: null };
      return { ...base, lemmaId: w };
    });
    sentences.push({ it: `${it}.`, en: 'English.', tokens, grammarIds: i === 0 ? grammarIds : [] });
  }
  return StorySchema.parse({
    id: 'test-01',
    seriesId: 'test',
    seriesIndex: 1,
    level: BAND_RULES[band].level,
    band,
    title: { it: 'Prova', en: 'Test' },
    paragraphs: [{ sentences }],
    targetLemmaIds: targets,
    grammarIds,
    wordCount: words.length,
  });
}

/** 100 words inside band 150, with three repeated targets (ranks 30, 40, 50). */
const base = (): Word[] => [
  ...Array.from({ length: 94 }, (_, i) => (i % 10) + 1),
  30,
  30,
  40,
  40,
  50,
  50,
];
const targets = [30, 40, 50];
const ok = (words: Word[], opts: StoryOptions = {}) =>
  validateStory(story(words, { targets, ...opts }), lemmas);

describe('validateStory', () => {
  it('accepts a story inside its band', () => {
    const report = ok(base());
    expect(report.errors).toEqual([]);
    expect(report.inBand).toBe(1);
    expect(report.wordCount).toBe(100);
    expect(report.longestSentence).toBe(8);
  });

  it('allows up to 2% from the next band and excludes names from coverage', () => {
    const words = base();
    words.splice(0, 2, 200, 250);
    const report = ok(words);
    expect(report.errors).toEqual([]);
    expect(report.nextBand).toBeCloseTo(0.02);
    expect(report.nextBandTokens).toEqual(['w200 (w200 #200)', 'w250 (w250 #250)']);

    words.splice(2, 1, 290);
    expect(ok(words).errors[0]).toMatch(/only 97\.0% of tokens within band 150/);

    const named = base();
    named.splice(0, 3, 'name', 'name', 200);
    const withNames = ok(named);
    expect(withNames.nameTokens).toBe(2);
    expect(withNames.countedTokens).toBe(98);
    expect(withNames.errors).toEqual([]);
  });

  it('rejects words beyond the next band, unknown words and too many names', () => {
    const words = base();
    words.splice(0, 1, 301);
    expect(ok(words).errors).toContain('tokens above rank 300: w301 (w301 #301)');
    words.splice(0, 1, 'unknown');
    expect(ok(words).errors).toContain('untagged tokens: boh');
    const named = base();
    named.splice(0, 13, ...Array<Word>(13).fill('name'));
    expect(ok(named).errors).toContain('names are 13.0% of tokens');
  });

  it('enforces the grammar ceiling of the band', () => {
    const passato = GRAMMAR_POINTS.find((p) => p.slug === 'passato-prossimo-avere')?.id ?? 0;
    const present = GRAMMAR_POINTS.find((p) => p.slug === 'present-are')?.id ?? 0;
    const report = ok(base(), { grammarIds: [present, passato].sort((a, b) => a - b) });
    expect(report.grammarUsed).toEqual(['present-are', 'passato-prossimo-avere']);
    expect(report.grammarNotAllowed).toEqual(['passato-prossimo-avere']);
    expect(report.errors[0]).toMatch(/grammar above band 150: passato-prossimo-avere/);
  });

  it('checks length, sentence length and targets', () => {
    expect(ok(base().slice(0, 60)).errors).toContain('60 words; band 150 wants 80-140');
    expect(ok(base(), { perSentence: 11 }).errors[0]).toMatch(/sentences over 10 words/);
    expect(ok(base(), { targets: [30, 40] }).errors[0]).toMatch(/2 target lemmas/);
    expect(ok(base(), { targets: [30, 40, 5] }).errors).toContain(
      'target w5 is not a repeated new word for band 150',
    );
  });
});

describe('validateCorpus', () => {
  const series: StorySeries = {
    id: 'test',
    title: { it: 'Prova', en: 'Test' },
    band: 150,
    blurb: 'A test series.',
  };
  it('checks numbering, bands and series ids', () => {
    const one = story(base(), { targets });
    expect(validateCorpus([series], [one])).toEqual([]);
    const gap = { ...one, id: 'test-03', seriesIndex: 3 };
    expect(validateCorpus([series], [one, gap])).toEqual([
      'series test episodes are not numbered 1..n: 1,3',
    ]);
    expect(validateCorpus([{ ...series, band: 300 }], [one])).toEqual([
      'test-01 is band 150, series is 300',
    ]);
    expect(validateCorpus([], [one])).toEqual(['test-01: unknown series test']);
  });
});
