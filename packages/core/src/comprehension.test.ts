import { describe, expect, it } from 'vitest';

import { buildComprehensionCheck, type ComprehensionSentence } from './index';

/** A sentence with one token per space-separated word; lemma ids from `ids`. */
function sentence(it: string, en: string, ids: (number | null)[]): ComprehensionSentence {
  let at = 0;
  const tokens = it
    .replace(/[.?!,]/g, '')
    .split(' ')
    .map((word, i) => {
      const start = it.indexOf(word, at);
      at = start + word.length;
      const lemmaId = ids[i] ?? null;
      return {
        start,
        end: start + word.length,
        lemmaId,
        ...(lemmaId === null ? { isName: true } : {}),
      };
    });
  return { it, en, tokens };
}

const STORY: ComprehensionSentence[] = [
  sentence('Luca ha un lavoro nuovo.', 'Luca has a new job.', [null, 1, 2, 3, 4]),
  sentence('Il lavoro è molto bello.', 'The job is very nice.', [5, 3, 6, 7, 8]),
  sentence('Luca prende il treno ogni mattina.', 'Luca takes the train every morning.', [
    null,
    9,
    5,
    10,
    11,
    12,
  ]),
  sentence('Il treno arriva sempre tardi.', 'The train always arrives late.', [5, 10, 13, 14, 15]),
  sentence('Oggi Luca parla con il capo.', 'Today Luca talks to the boss.', [
    16,
    null,
    17,
    18,
    5,
    19,
  ]),
  sentence('Il capo non è contento.', 'The boss is not happy.', [5, 19, 20, 6, 21]),
];

const POS: Record<number, string> = {
  1: 'VERB',
  3: 'NOUN',
  4: 'ADJ',
  8: 'ADJ',
  9: 'VERB',
  10: 'NOUN',
  11: 'DET',
  12: 'NOUN',
  13: 'VERB',
  15: 'ADV',
  17: 'VERB',
  19: 'NOUN',
  21: 'ADJ',
};
const CONTENT = new Set(['NOUN', 'VERB', 'ADJ', 'ADV']);
const options = {
  posOf: (id: number) => POS[id],
  isContentWord: (id: number) => CONTENT.has(POS[id] ?? ''),
};

describe('buildComprehensionCheck', () => {
  it('builds two cloze items and one true/false item from different parts of the story', () => {
    const items = buildComprehensionCheck(STORY, { ...options, seed: 7 });
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.kind).sort()).toEqual(['cloze', 'cloze', 'true_false']);
    const indexes = items.map((i) => i.sentenceIndex);
    expect(new Set(indexes).size).toBe(3);
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
  });

  it('blanks a content word and offers distinct options including the answer', () => {
    for (let seed = 0; seed < 20; seed++) {
      for (const item of buildComprehensionCheck(STORY, { ...options, seed })) {
        if (item.kind !== 'cloze') continue;
        const s = STORY[item.sentenceIndex];
        expect(`${item.before}${item.answer}${item.after}`).toBe(s?.it);
        expect(item.options).toContain(item.answer);
        expect(new Set(item.options.map((o) => o.toLowerCase())).size).toBe(item.options.length);
        expect(item.options.length).toBeGreaterThanOrEqual(2);
        expect(item.options.length).toBeLessThanOrEqual(4);
        expect(item.translation).toBe(s?.en);
        expect(['Luca', 'il', 'un', 'è', 'non', 'ogni']).not.toContain(item.answer);
      }
    }
  });

  it('makes true/false claims from the story itself, true and false', () => {
    const answers = new Set<boolean>();
    for (let seed = 0; seed < 30; seed++) {
      const item = buildComprehensionCheck(STORY, { ...options, seed }).find(
        (i) => i.kind === 'true_false',
      );
      if (item?.kind !== 'true_false') throw new Error('missing true/false item');
      const s = STORY[item.sentenceIndex];
      expect(item.it).toBe(s?.it);
      expect(item.translation).toBe(s?.en);
      expect(item.answer).toBe(item.claim === s?.en);
      expect(STORY.map((x) => x.en)).toContain(item.claim);
      answers.add(item.answer);
    }
    expect(answers).toEqual(new Set([true, false]));
  });

  it('prefers target words as blanks', () => {
    const items = buildComprehensionCheck(STORY, {
      ...options,
      seed: 3,
      preferLemmaIds: new Set([10]),
    });
    const clozes = items.filter((i) => i.kind === 'cloze');
    expect(clozes.some((i) => i.answer === 'treno')).toBe(true);
  });

  it('is deterministic for a seed and copes with tiny stories', () => {
    expect(buildComprehensionCheck(STORY, { ...options, seed: 5 })).toEqual(
      buildComprehensionCheck(STORY, { ...options, seed: 5 }),
    );
    expect(buildComprehensionCheck([], options)).toEqual([]);
    const one = buildComprehensionCheck(STORY.slice(0, 1), options);
    expect(one.length).toBeLessThanOrEqual(1);
  });
});
