import { describe, expect, it } from 'vitest';

import { type Candidate, selectSentences } from './select';

// Lemma ids equal their ranks here: 1 is the most frequent.
const cand = (id: number, lemmaIds: number[], score = 0, form = `f${id}`): Candidate => {
  const difficulty = Math.max(...lemmaIds);
  return {
    id,
    norm: `s${id}`,
    lemmaIds,
    difficulty,
    rarestLemmaId: difficulty,
    formOf: new Map(lemmaIds.map((l) => [l, l === difficulty ? form : `x${l}`])),
    score,
  };
};

describe('selectSentences', () => {
  const options = { perLemma: 2, fallbackPerLemma: 1, perForm: 1 };

  it('picks the best n+1 anchors for each lemma, preferring varied forms', () => {
    const chosen = selectSentences(
      [
        cand(10, [1, 2, 3], 1, 'a'),
        cand(11, [1, 3], 3, 'a'),
        cand(12, [2, 3], 2, 'b'),
        cand(13, [1, 3], 0, 'c'),
      ],
      [1, 2, 3],
      options,
    );
    const forThree = [...chosen]
      .filter(([, s]) => s.targetLemmaId === 3 && s.anchor)
      .map(([id]) => id);
    expect(forThree).toEqual([11, 12]);
  });

  it('gives lemmas that are never the rarest word a fallback sentence', () => {
    const chosen = selectSentences([cand(20, [1, 2, 5]), cand(21, [1, 4])], [1, 2, 4, 5], options);
    const fallbacks = [...chosen.values()].filter((s) => !s.anchor).map((s) => s.targetLemmaId);
    expect(fallbacks).toEqual([]);
    // Both sentences are anchors (for 5 and 4); 1 and 2 had no anchor and no free sentence.
    expect(chosen.get(20)).toEqual({ targetLemmaId: 5, anchor: true });

    const more = selectSentences(
      [cand(30, [1, 2, 5]), cand(31, [1, 2, 5]), cand(32, [1, 3])],
      [1, 2, 3, 5],
      {
        ...options,
        perLemma: 1,
      },
    );
    expect(more.get(31)).toEqual({ targetLemmaId: 1, anchor: false });
  });

  it('never selects near-duplicates twice for a lemma', () => {
    const a = cand(40, [1, 2]);
    const b = { ...cand(41, [1, 2]), norm: a.norm };
    const chosen = selectSentences([a, b], [1, 2], { ...options, perLemma: 5, perForm: 5 });
    expect([...chosen.keys()]).toEqual([40]);
  });
});
