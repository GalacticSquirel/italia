import { describe, expect, it } from 'vitest';

import {
  checkGeminates,
  checkSegmentals,
  checkStress,
  FEEDBACK_KEYS,
  g2p,
  scorePronunciation,
  syllableProsodyFromScore,
  type WordG2P,
} from './index';
import { timeline, type PhoneSpec } from './testUtils';

function run(text: string, specs: readonly PhoneSpec[]) {
  const result = g2p(text);
  return { result, score: scorePronunciation(result, timeline(specs)) };
}

function word(text: string): WordG2P {
  const w = g2p(text).words[0];
  if (!w) throw new Error(text);
  return w;
}

describe('checkGeminates', () => {
  const palla = (lMs: number, extra: Partial<{ phone: string }> = {}) =>
    run('la palla', [
      ['l', 70],
      ['a', 90],
      ['p', 70],
      ['a', 100],
      [extra.phone ?? 'l', lMs],
      ['a', 110],
    ]);

  it('passes a long consonant at twice the reference duration', () => {
    const { result, score } = palla(140);
    const checks = checkGeminates(result, score);
    const l = checks.find((c) => c.expectedLong);
    expect(l).toMatchObject({ verdict: 'ok', ratio: 2, phoneme: 'l', wordIndex: 1 });
    expect(l?.feedback).toEqual({
      key: 'speech.geminate.ok',
      params: { word: 'palla', phoneme: 'l', letters: 'll', ratio: 2 },
    });
  });

  it('flags a geminate said as a single consonant', () => {
    const { result, score } = palla(75);
    const l = checkGeminates(result, score).find((c) => c.expectedLong);
    expect(l?.verdict).toBe('soundedSingle');
    expect(l?.feedback.key).toBe('speech.geminate.soundedSingle');
  });

  it('calls the middle ground borderline', () => {
    const { result, score } = palla(95);
    expect(checkGeminates(result, score).find((c) => c.expectedLong)?.verdict).toBe('borderline');
  });

  it('trusts a recognizer that marks the consonant long', () => {
    const { result, score } = palla(75, { phone: 'lː' });
    expect(checkGeminates(result, score).find((c) => c.expectedLong)?.verdict).toBe('ok');
  });

  it('flags an over-long single consonant', () => {
    const { result, score } = run('la pala', [
      ['l', 70],
      ['a', 90],
      ['p', 70],
      ['a', 100],
      ['l', 150],
      ['a', 110],
    ]);
    const l = checkGeminates(result, score).find((c) => c.wordIndex === 1 && c.phoneme === 'l');
    expect(l).toMatchObject({ expectedLong: false, verdict: 'soundedDouble' });
    const okay = run('la pala', [
      ['l', 70],
      ['a', 90],
      ['p', 70],
      ['a', 100],
      ['l', 72],
      ['a', 110],
    ]);
    const single = checkGeminates(okay.result, okay.score).find(
      (c) => c.wordIndex === 1 && c.phoneme === 'l',
    );
    expect(single?.verdict).toBe('ok');
    expect(
      checkGeminates(okay.result, okay.score, { checkSingles: false }).some((c) => !c.expectedLong),
    ).toBe(false);
  });

  it('prefers the closure duration when given', () => {
    const { result, score } = run('la patta', [
      ['l', 70],
      ['a', 90],
      ['p', 70, 0.9, { closureMs: 50 }],
      ['a', 100],
      ['t', 140, 0.9, { closureMs: 120 }],
      ['a', 110],
    ]);
    // reference = median(l 70, p 50) = 60, t closure 120 → ratio 2
    expect(checkGeminates(result, score).find((c) => c.expectedLong)?.ratio).toBe(2);
  });

  it('reports a missing consonant and insufficient data', () => {
    const missing = run('la palla', [
      ['l', 70],
      ['a', 90],
      ['p', 70],
      ['a', 100],
      ['a', 110],
    ]);
    expect(checkGeminates(missing.result, missing.score).find((c) => c.expectedLong)?.verdict).toBe(
      'missing',
    );
    const tiny = run('otto', [['t', 150]]);
    expect(checkGeminates(tiny.result, tiny.score)[0]?.verdict).toBe('insufficientData');
  });

  it('skips intrinsic geminates unless asked', () => {
    const { result, score } = run('il figlio', [
      ['i', 60],
      ['l', 60],
      ['f', 70],
      ['i', 80],
      ['ʎ', 130],
      ['o', 100],
    ]);
    expect(checkGeminates(result, score).some((c) => c.phoneme === 'ʎ')).toBe(false);
    const withIntrinsic = checkGeminates(result, score, { includeIntrinsic: true });
    expect(withIntrinsic.find((c) => c.phoneme === 'ʎ')).toMatchObject({
      expectedLong: true,
      verdict: 'ok',
    });
  });
});

describe('checkStress', () => {
  const tavolo = word('tavolo');

  it('accepts stress on the expected syllable', () => {
    const check = checkStress(tavolo, [
      { durationMs: 120 },
      { durationMs: 60 },
      { durationMs: 70 },
    ]);
    expect(check).toMatchObject({ verdict: 'ok', expectedSyllable: 0, detectedSyllable: 0 });
    expect(check.feedback.key).toBe('speech.stress.ok');
  });

  it('detects stress on the wrong syllable', () => {
    const check = checkStress(tavolo, [
      { durationMs: 60 },
      { durationMs: 130 },
      { durationMs: 70 },
    ]);
    expect(check.verdict).toBe('wrongSyllable');
    expect(check.feedback).toEqual({
      key: 'speech.stress.wrongSyllable',
      params: { word: 'tavolo', expected: 'ta', heard: 'vo' },
    });
  });

  it('is unclear when two syllables are about equally prominent', () => {
    const check = checkStress(tavolo, [
      { durationMs: 98 },
      { durationMs: 100 },
      { durationMs: 60 },
    ]);
    expect(check.verdict).toBe('unclear');
  });

  it('discounts phrase-final lengthening', () => {
    const citta = word('città');
    const prosody = [{ durationMs: 100 }, { durationMs: 115 }];
    expect(checkStress(citta, prosody).verdict).toBe('wrongSyllable');
    expect(checkStress(citta, prosody, { phraseFinal: false }).verdict).toBe('ok');
  });

  it('combines energy and pitch with duration', () => {
    const casa = word('casa');
    const check = checkStress(casa, [
      { durationMs: 100, energyDb: 70, f0Hz: 220 },
      { durationMs: 100, energyDb: 62, f0Hz: 180 },
    ]);
    expect(check.verdict).toBe('ok');
    expect(check.prominence[0]).toBeGreaterThan(check.prominence[1] ?? 0);
  });

  it('is not applicable to monosyllables and unstressed words', () => {
    expect(checkStress(word('blu'), [{ durationMs: 100 }]).verdict).toBe('notApplicable');
    expect(checkStress(word('il'), [{ durationMs: 100 }]).feedback.key).toBe(
      'speech.stress.notApplicable',
    );
  });

  it('requires one measurement per syllable', () => {
    expect(() => checkStress(tavolo, [{ durationMs: 100 }])).toThrow(RangeError);
  });

  it('can take nucleus durations from the alignment', () => {
    const { result, score } = run('tavolo', [
      ['t', 60],
      ['a', 130],
      ['v', 60],
      ['o', 60],
      ['l', 60],
      ['o', 80],
    ]);
    const prosody = syllableProsodyFromScore(result, score, 0);
    expect(prosody).toEqual([{ durationMs: 130 }, { durationMs: 60 }, { durationMs: 80 }]);
    const w = result.words[0];
    if (w) expect(checkStress(w, prosody).verdict).toBe('ok');
  });
});

describe('checkSegmentals', () => {
  it('flags a final vowel reduced to schwa', () => {
    const { result, score } = run('pane', [
      ['p', 80],
      ['a', 120],
      ['n', 80],
      ['ə', 60],
    ]);
    const issues = checkSegmentals(result, score);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'finalReduced', phoneme: 'e' });
    expect(issues[0]?.feedback).toEqual({
      key: 'speech.vowel.finalReduced',
      params: { word: 'pane', phoneme: 'e', letters: 'e', heard: 'ə' },
    });
  });

  it('flags a dropped final vowel', () => {
    const { result, score } = run('pane', [
      ['p', 80],
      ['a', 120],
      ['n', 80],
    ]);
    expect(checkSegmentals(result, score).map((i) => i.kind)).toEqual(['finalDropped']);
  });

  it('flags other unstressed vowels reduced to schwa', () => {
    const { result, score } = run('telefono', [
      ['t', 60],
      ['ə', 50],
      ['l', 60],
      ['ɛ', 110],
      ['f', 70],
      ['o', 70],
      ['n', 60],
      ['o', 90],
    ]);
    expect(checkSegmentals(result, score).map((i) => [i.kind, i.phoneIndex])).toEqual([
      ['reduced', 1],
    ]);
  });

  it('flags diphthongised mid vowels', () => {
    const diph = run('sole', [
      ['s', 80],
      ['oʊ', 150],
      ['l', 70],
      ['e', 90],
    ]);
    expect(checkSegmentals(diph.result, diph.score).map((i) => i.kind)).toEqual(['diphthongised']);
    const glide = run('sole', [
      ['s', 80],
      ['o', 100],
      ['w', 40],
      ['l', 70],
      ['e', 90],
    ]);
    expect(checkSegmentals(glide.result, glide.score)).toMatchObject([
      { kind: 'diphthongised', phoneme: 'o', feedback: { key: 'speech.vowel.diphthongised' } },
    ]);
  });

  it('does not flag expected falling diphthongs', () => {
    const { result, score } = run('sei', [
      ['s', 80],
      ['ɛ', 120],
      ['i', 60],
    ]);
    expect(checkSegmentals(result, score)).toEqual([]);
  });

  it('flags aspirated voiceless stops from labels or VOT', () => {
    const label = run('pasta', [
      ['pʰ', 90],
      ['a', 100],
      ['s', 80],
      ['t', 70],
      ['a', 90],
    ]);
    expect(checkSegmentals(label.result, label.score).map((i) => i.kind)).toEqual(['aspirated']);
    const vot = run('pasta', [
      ['p', 90, 0.9, { votMs: 70 }],
      ['a', 100],
      ['s', 80],
      ['t', 70, 0.9, { votMs: 20 }],
      ['a', 90],
    ]);
    const issues = checkSegmentals(vot.result, vot.score);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.feedback).toEqual({
      key: 'speech.consonant.aspirated',
      params: { word: 'pasta', phoneme: 'p', letters: 'p', votMs: 70 },
    });
  });

  it('only emits documented feedback keys', () => {
    const { result, score } = run('pane', [
      ['p', 80],
      ['a', 120],
      ['n', 80],
      ['ə', 60],
    ]);
    for (const issue of checkSegmentals(result, score)) {
      expect(FEEDBACK_KEYS).toContain(issue.feedback.key);
    }
  });
});
