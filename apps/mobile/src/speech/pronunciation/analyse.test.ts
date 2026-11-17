import type { RecognizedPhone } from '@italia/speech';

import { analysePronunciation, MAX_ISSUES } from './analyse';

/** Phones laid end to end with the given durations (ms). */
function phones(spec: readonly [string, number][], prob = 0.95): RecognizedPhone[] {
  let t = 0;
  return spec.map(([phone, ms]) => {
    const p = { phone, startMs: t, endMs: t + ms, prob };
    t += ms;
    return p;
  });
}

describe('analysePronunciation', () => {
  it('scores a native-like "fatto" highly with no issues', () => {
    const a = analysePronunciation(
      'fatto',
      phones([
        ['f', 80],
        ['a', 120],
        ['t', 80],
        ['t', 80],
        ['o', 100],
      ]),
    );
    expect(a.score.overall).toBeGreaterThan(0.9);
    expect(a.score.words).toHaveLength(1);
    expect(a.score.words[0]?.word).toBe('fatto');
    expect(a.score.issues).toEqual([]);
    expect(a.feedback.map((f) => f.feedback.key)).toContain('speech.stress.ok');
  });

  it('flags a single consonant said for a double one, phrased for the learner', () => {
    const a = analysePronunciation(
      'la palla',
      phones([
        ['l', 60],
        ['a', 90],
        ['p', 60],
        ['a', 130],
        ['l', 55],
        ['a', 100],
      ]),
    );
    expect(a.score.issues[0]).toMatchObject({ kind: 'double_consonant', wordIndex: 1 });
    expect(a.score.issues[0]?.message).toContain('palla');
  });

  it('limits issues and gives at most one per word, most important first', () => {
    const a = analysePronunciation(
      'fatto pane caro',
      phones([
        ['f', 70],
        ['a', 120],
        ['t', 60],
        ['o', 90],
        ['p', 70],
        ['a', 120],
        ['n', 60],
        ['ə', 50],
        ['k', 60],
        ['a', 120],
        ['ɾ', 50],
        ['ə', 50],
      ]),
    );
    expect(a.score.issues.length).toBeLessThanOrEqual(MAX_ISSUES);
    expect(new Set(a.score.issues.map((i) => i.wordIndex)).size).toBe(a.score.issues.length);
    expect(a.score.issues[0]?.kind).toBe('double_consonant');
  });

  it('says so when nothing was heard', () => {
    const a = analysePronunciation('ciao', []);
    expect(a.score.overall).toBe(0);
    expect(a.score.issues[0]?.message).toMatch(/could not hear you/);
  });

  it('uses audio energy for stress when given', () => {
    const p = phones([
      ['a', 100],
      ['n', 60],
      ['k', 60],
      ['o', 100],
      ['r', 50],
      ['a', 100],
    ]);
    const rate = 1000;
    const samples = new Float32Array(470).fill(0.05);
    samples.fill(0.9, 0, 100); // a loud first vowel: "àncora"
    const a = analysePronunciation('àncora', p, { samples, sampleRateHz: rate });
    expect(a.feedback.find((f) => f.feedback.key.startsWith('speech.stress'))?.feedback.key).toBe(
      'speech.stress.ok',
    );
  });
});
