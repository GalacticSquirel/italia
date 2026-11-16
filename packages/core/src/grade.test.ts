import { describe, expect, it } from 'vitest';

import {
  CARD_KINDS,
  DEFAULT_EASY_LATENCY_MS,
  gradeAnswer,
  gradeSpoken,
  gradeTyped,
  normaliseAnswer,
  ratingFor,
  type GradeResult,
} from './index';

describe('normaliseAnswer', () => {
  it.each([
    ['  Ciao,   Marco! ', 'ciao marco'],
    ['L’acqua', "l'acqua"],
    ["l' acqua", "l'acqua"],
    ["l 'acqua", "l'acqua"],
    ['Dov‘è?', "dov'è"],
    ['«Va bene.»', 'va bene'],
    ['un po’ di pane', "un po' di pane"],
    ['ventuno-due', 'ventuno due'],
    ['PERCHÉ', 'perché'],
    ['é', 'é'],
  ])('normalises %j to %j', (input, expected) => {
    expect(normaliseAnswer(input)).toBe(expected);
  });
});

describe('gradeAnswer', () => {
  it('accepts an exact match ignoring case, punctuation and apostrophe style', () => {
    const result = gradeAnswer('l’ Acqua.', ["L'acqua"]);
    expect(result.verdict).toBe('exact');
    expect(result.correct).toBe(true);
    expect(result.accentOnly).toBe(false);
    expect(result.typoCount).toBe(0);
    expect(result.matched).toBe("L'acqua");
    expect(result.diff).toEqual([{ type: 'equal', given: "l'acqua", expected: "l'acqua" }]);
  });

  it('flags a missing or wrong accent as correct with accentOnly', () => {
    for (const answer of ['perche', 'perchè', "perche'"]) {
      const result = gradeAnswer(answer, ['perché']);
      expect(result.verdict).toBe('accent_only');
      expect(result.correct).toBe(true);
      expect(result.accentOnly).toBe(true);
      expect(result.typoCount).toBe(0);
    }
  });

  it('marks the accent mismatch in the diff', () => {
    const result = gradeAnswer('caffe', ['caffè']);
    expect(result.diff).toEqual([
      { type: 'equal', given: 'caff', expected: 'caff' },
      { type: 'accent', given: 'e', expected: 'è' },
    ]);
  });

  it('tolerates one typo per eight characters', () => {
    const long = gradeAnswer('la machina rossa', ['la macchina rossa']);
    expect(long.verdict).toBe('typo');
    expect(long.correct).toBe(true);
    expect(long.typoCount).toBe(1);
    expect(long.diff).toContainEqual({ type: 'missing', given: '', expected: 'c' });

    // Seven characters allow no typo.
    expect(gradeAnswer('ragazo', ['ragazzo']).verdict).toBe('wrong');
    // Eight characters allow one.
    expect(gradeAnswer('stazone', ['stazione']).verdict).toBe('typo');
  });

  it('counts a transposition as one typo', () => {
    const result = gradeAnswer('la stazinoe', ['la stazione']);
    expect(result.verdict).toBe('typo');
    expect(result.typoCount).toBe(1);
  });

  it('rejects answers beyond the typo allowance', () => {
    const result = gradeAnswer('la mchina rosa', ['la macchina rossa']);
    expect(result.verdict).toBe('wrong');
    expect(result.correct).toBe(false);
    expect(result.typoCount).toBe(3);
  });

  it('rejects an empty answer', () => {
    const result = gradeAnswer('  ', ['ciao']);
    expect(result.verdict).toBe('wrong');
    expect(result.diff).toEqual([{ type: 'missing', given: '', expected: 'ciao' }]);
  });

  it('picks the best of several accepted answers', () => {
    const result = gradeAnswer('sono stanca', ['sono stanco', 'sono stanca']);
    expect(result.verdict).toBe('exact');
    expect(result.matched).toBe('sono stanca');

    const accent = gradeAnswer('e vero', ['è vero', 'è verissimo']);
    expect(accent.verdict).toBe('accent_only');
    expect(accent.matched).toBe('è vero');
  });

  it('prefers an accent-only match over a typo match', () => {
    const result = gradeAnswer('citta grande', ['cittá grandi', 'città grande']);
    expect(result.verdict).toBe('accent_only');
    expect(result.matched).toBe('città grande');
  });

  it('honours a custom typo allowance', () => {
    expect(gradeAnswer('ragazo', ['ragazzo'], { charsPerTypo: 5 }).verdict).toBe('typo');
  });

  it('builds a diff whose sides reconstruct the two strings', () => {
    const pairs: [string, string][] = [
      ['la mchina rosa', 'la macchina rossa'],
      ['buongiorno', 'buona sera'],
      ['xyz', 'ciao'],
      ['perche no', 'perché no'],
    ];
    for (const [given, expected] of pairs) {
      const result = gradeAnswer(given, [expected]);
      expect(result.diff.map((s) => s.given).join('')).toBe(result.normalisedAnswer);
      expect(result.diff.map((s) => s.expected).join('')).toBe(result.normalisedExpected);
      for (let i = 1; i < result.diff.length; i++) {
        expect(result.diff[i]?.type).not.toBe(result.diff[i - 1]?.type);
      }
    }
  });

  it('rejects invalid input', () => {
    expect(() => gradeAnswer('ciao', [])).toThrow(RangeError);
    expect(() => gradeAnswer('ciao', ['ciao'], { charsPerTypo: 0 })).toThrow(RangeError);
  });
});

describe('ratingFor', () => {
  const exact = gradeAnswer('ciao', ['ciao']);

  it('maps verdicts and latency to ratings', () => {
    const easyMs = DEFAULT_EASY_LATENCY_MS.typed.cloze_production;
    expect(ratingFor(exact, { kind: 'cloze_production', latencyMs: easyMs })).toBe('easy');
    expect(ratingFor(exact, { kind: 'cloze_production', latencyMs: easyMs + 1 })).toBe('good');
    expect(
      ratingFor(gradeAnswer('caffe', ['caffè']), { kind: 'cloze_production', latencyMs: 1 }),
    ).toBe('hard');
    expect(
      ratingFor(gradeAnswer('stazone', ['stazione']), { kind: 'cloze_production', latencyMs: 1 }),
    ).toBe('hard');
    expect(
      ratingFor(gradeAnswer('treno', ['stazione']), { kind: 'cloze_production', latencyMs: 1 }),
    ).toBe('again');
  });

  it('has a threshold for every kind and mode, longer for sentence production', () => {
    for (const kind of CARD_KINDS) {
      expect(DEFAULT_EASY_LATENCY_MS.typed[kind]).toBeGreaterThan(0);
      expect(DEFAULT_EASY_LATENCY_MS.spoken[kind]).toBeGreaterThan(0);
    }
    expect(DEFAULT_EASY_LATENCY_MS.typed.sentence_production).toBeGreaterThan(
      DEFAULT_EASY_LATENCY_MS.typed.recognition,
    );
  });

  it('uses configurable thresholds', () => {
    const thresholds = {
      ...DEFAULT_EASY_LATENCY_MS,
      typed: { ...DEFAULT_EASY_LATENCY_MS.typed, recognition: 100 },
    };
    expect(ratingFor(exact, { kind: 'recognition', latencyMs: 150 }, thresholds)).toBe('good');
    expect(ratingFor(exact, { kind: 'recognition', latencyMs: 100 }, thresholds)).toBe('easy');
  });

  it('rejects a negative latency', () => {
    expect(() => ratingFor(exact, { kind: 'recognition', latencyMs: -1 })).toThrow(RangeError);
  });
});

describe('gradeTyped', () => {
  it('grades and rates in one call', () => {
    const { grade, rating } = gradeTyped({
      answer: "Dov'e la stazione?",
      accepted: ["Dov'è la stazione?"],
      kind: 'sentence_production',
      latencyMs: 30_000,
    });
    expect(grade.verdict).toBe('accent_only');
    expect(rating).toBe('hard');
  });
});

describe('gradeSpoken', () => {
  const base = { accepted: ['ragazzo'], kind: 'spoken_prompt' as const, latencyMs: 60_000 };

  it('is more lenient with typos than typed grading', () => {
    expect(gradeTyped({ ...base, answer: 'ragazo' }).grade.verdict).toBe('wrong');
    const spoken = gradeSpoken({ ...base, transcript: 'ragazo' });
    expect(spoken.grade.verdict).toBe('typo');
    expect(spoken.rating).toBe('hard');
  });

  it('never lets the pronunciation score change the rating', () => {
    const results = [0, 0.5, 1, null].map(
      (score) => gradeSpoken({ ...base, transcript: 'ragazzo', pronunciationScore: score }).rating,
    );
    expect(new Set(results)).toEqual(new Set(['good']));
    const kept = gradeSpoken({ ...base, transcript: 'ragazzo', pronunciationScore: 0.42 });
    expect(kept.pronunciationScore).toBe(0.42);
    expect(gradeSpoken({ ...base, transcript: 'x' }).pronunciationScore).toBeNull();
  });

  it('uses spoken latency thresholds', () => {
    const fast = gradeSpoken({
      ...base,
      transcript: 'ragazzo',
      latencyMs: DEFAULT_EASY_LATENCY_MS.spoken.spoken_prompt,
    });
    expect(fast.rating).toBe('easy');
  });

  it('rejects a pronunciation score outside 0 to 1', () => {
    expect(() => gradeSpoken({ ...base, transcript: 'x', pronunciationScore: 2 })).toThrow(
      RangeError,
    );
  });
});

// Type-level check: verdicts are a closed union.
export function describeVerdict(result: GradeResult): string {
  switch (result.verdict) {
    case 'exact':
      return 'exact';
    case 'accent_only':
      return 'accent';
    case 'typo':
      return 'typo';
    case 'wrong':
      return 'wrong';
  }
}
