import { describe, expect, it } from 'vitest';

import {
  coverage,
  selectStories,
  storyFit,
  type CoverageToken,
  type SelectableStory,
} from './index';

/** A story of 100 counted tokens, `known` of them from lemma 1 and the rest unknown lemmas. */
function story(
  id: string,
  seriesId: string,
  seriesIndex: number,
  knownTokens: number,
  targets: number[] = [],
): SelectableStory {
  const tokens: CoverageToken[] = [
    { lemmaId: null, properNoun: true },
    ...Array.from({ length: knownTokens }, () => ({ lemmaId: 1 })),
    ...Array.from({ length: 100 - knownTokens }, (_, i) => ({ lemmaId: 1000 + i })),
  ];
  return { id, seriesId, seriesIndex, tokens, targetLemmaIds: targets };
}

const KNOWN = new Set([1]);

describe('storyFit', () => {
  it('classifies coverage against the 95-98% window and the 90% floor', () => {
    expect(storyFit(0.95)).toBe('ideal');
    expect(storyFit(0.98)).toBe('ideal');
    expect(storyFit(0.99)).toBe('easy');
    expect(storyFit(0.9)).toBe('stretch');
    expect(storyFit(0.94)).toBe('stretch');
    expect(storyFit(0.89)).toBe('hard');
  });

  it('rejects a floor above the window', () => {
    expect(() => storyFit(0.9, [0.95, 0.98], 0.96)).toThrow(RangeError);
  });
});

describe('coverage with packed lemmas', () => {
  it('counts a contracted word as known only when all its lemmas are known', () => {
    const result = coverage(
      [
        { lemmaId: 1, partIds: [2] },
        { lemmaId: 1, partIds: [3] },
      ],
      new Set([1, 2]),
    );
    expect(result.ratio).toBe(0.5);
    expect(result.unknownLemmaIds).toEqual([3]);
  });
});

describe('selectStories', () => {
  it('locks episodes until the previous one is read', () => {
    const { series } = selectStories({
      stories: [story('a-02', 'a', 2, 96), story('a-01', 'a', 1, 96), story('a-03', 'a', 3, 96)],
      read: new Set(['a-01']),
      known: KNOWN,
    });
    expect(series).toHaveLength(1);
    const [a] = series;
    expect(a?.episodes.map((e) => [e.id, e.read, e.locked])).toEqual([
      ['a-01', true, false],
      ['a-02', false, false],
      ['a-03', false, true],
    ]);
    expect(a?.next?.id).toBe('a-02');
    expect(a?.readCount).toBe(1);
  });

  it('picks the next unread episode inside the window', () => {
    const result = selectStories({
      stories: [story('a-01', 'a', 1, 99), story('b-01', 'b', 1, 96), story('c-01', 'c', 1, 92)],
      read: new Set(),
      known: KNOWN,
    });
    expect(result.upNext?.id).toBe('b-01');
    expect(result.upNext?.fit).toBe('ideal');
    expect(result.upNext?.coverage.ratio).toBeCloseTo(0.96);
    expect(result.closest).toBeNull();
  });

  it('prefers a started series, then 3 to 6 new target words, among ideal episodes', () => {
    const stories = [
      story('a-01', 'a', 1, 97, [1000]),
      story('b-01', 'b', 1, 96, [1000, 1001, 1002, 1003]),
      story('c-01', 'c', 1, 100),
      story('c-02', 'c', 2, 95),
    ];
    expect(selectStories({ stories, read: new Set(), known: KNOWN }).upNext?.id).toBe('b-01');
    expect(selectStories({ stories, read: new Set(['c-01']), known: KNOWN }).upNext?.id).toBe(
      'c-02',
    );
  });

  it('falls back to the episode closest to the window above the floor', () => {
    const result = selectStories({
      stories: [story('a-01', 'a', 1, 91), story('b-01', 'b', 1, 93), story('c-01', 'c', 1, 100)],
      read: new Set(),
      known: KNOWN,
    });
    // 93% is 2 points under the window; 100% is 2 points over it: the tie
    // keeps series order, so b (earlier) wins over c.
    expect(result.upNext?.id).toBe('b-01');
    expect(result.upNext?.fit).toBe('stretch');
  });

  it('recommends nothing below the floor but reports the closest episode', () => {
    const result = selectStories({
      stories: [story('a-01', 'a', 1, 40), story('b-01', 'b', 1, 70)],
      read: new Set(),
      known: KNOWN,
    });
    expect(result.upNext).toBeNull();
    expect(result.closest?.id).toBe('b-01');
    expect(result.closest?.fit).toBe('hard');
  });

  it('never recommends a finished series and lists unmet target words', () => {
    const result = selectStories({
      stories: [story('a-01', 'a', 1, 96, [5, 6, 7]), story('b-01', 'b', 1, 96, [8])],
      read: new Set(['a-01']),
      known: KNOWN,
      met: new Set([1, 8]),
    });
    expect(result.series[0]?.next).toBeNull();
    expect(result.upNext?.id).toBe('b-01');
    expect(result.upNext?.unmetTargetLemmaIds).toEqual([]);
    expect(result.series[0]?.episodes[0]?.unmetTargetLemmaIds).toEqual([5, 6, 7]);
  });
});
