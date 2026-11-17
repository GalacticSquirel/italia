import { describe, expect, it } from 'vitest';

import {
  alignPhones,
  g2p,
  phoneScoreFromLogPosterior,
  prepareSegments,
  scorePronunciation,
  type Phoneme,
} from './index';
import { timeline } from './testUtils';

const exp = (...phonemes: Phoneme[]) => phonemes.map((phoneme) => ({ phoneme, alternatives: [] }));

describe('prepareSegments', () => {
  it('drops silence, normalises labels and merges repeated consonants', () => {
    const segs = prepareSegments(
      timeline([
        ['sil', 100],
        ['f', 80, 0.9],
        ['a', 100, 0.8],
        ['t', 60, 0.9],
        ['t', 60, 0.7],
        ['o', 90],
        ['<pad>', 50],
      ]),
    );
    expect(segs.map((s) => s.symbol)).toEqual(['f', 'a', 't', 'o']);
    expect(segs[2]).toMatchObject({ long: true, startMs: 280, endMs: 400, sources: [3, 4] });
    expect(segs[2]?.prob).toBeCloseTo(0.8);
  });

  it('does not merge repeated vowels and keeps length marks', () => {
    const segs = prepareSegments(
      timeline([
        ['a', 50],
        ['a', 50],
        ['tː', 120],
        ['g', 40],
      ]),
    );
    expect(segs.map((s) => s.symbol)).toEqual(['a', 'a', 't', 'ɡ']);
    expect(segs[2]?.long).toBe(true);
  });
});

describe('alignPhones', () => {
  it('matches identical sequences', () => {
    const steps = alignPhones(exp('k', 'a', 'z', 'a'), [
      { symbol: 'k' },
      { symbol: 'a' },
      { symbol: 'z' },
      { symbol: 'a' },
    ]);
    expect(steps.map((s) => s.kind)).toEqual(['match', 'match', 'match', 'match']);
  });

  it('prefers a substitution to a deletion plus an insertion', () => {
    const steps = alignPhones(exp('f', 'a', 't', 'o'), [
      { symbol: 'f' },
      { symbol: 'a' },
      { symbol: 'd' },
      { symbol: 'o' },
    ]);
    expect(steps.map((s) => s.kind)).toEqual(['match', 'match', 'substitution', 'match']);
    expect(steps[2]?.cost).toBe(0.35);
  });

  it('finds deletions and insertions', () => {
    const del = alignPhones(exp('p', 'a', 'n', 'e'), [
      { symbol: 'p' },
      { symbol: 'a' },
      { symbol: 'n' },
    ]);
    expect(del.map((s) => s.kind)).toEqual(['match', 'match', 'match', 'deletion']);
    const ins = alignPhones(exp('s', 'p', 'O', 'r', 't'), [
      { symbol: 'ə' },
      { symbol: 's' },
      { symbol: 'p' },
      { symbol: 'O' },
      { symbol: 'r' },
      { symbol: 't' },
    ]);
    expect(ins.map((s) => s.kind)).toEqual([
      'insertion',
      'match',
      'match',
      'match',
      'match',
      'match',
    ]);
  });

  it('uses phonetic distance to choose between alignments', () => {
    // "pane" heard as "p a n ə": ə lines up with e, not with an insertion.
    const steps = alignPhones(exp('p', 'a', 'n', 'e'), [
      { symbol: 'p' },
      { symbol: 'a' },
      { symbol: 'n' },
      { symbol: 'ə' },
    ]);
    expect(steps.map((s) => s.kind)).toEqual(['match', 'match', 'match', 'substitution']);
  });

  it('accepts alternatives at zero cost', () => {
    const steps = alignPhones([{ phoneme: 'E', alternatives: ['e', 'ɛ'] }], [{ symbol: 'ɛ' }]);
    expect(steps[0]).toMatchObject({ kind: 'match', cost: 0 });
  });

  it('handles empty inputs', () => {
    expect(alignPhones([], [])).toEqual([]);
    expect(alignPhones(exp('a'), []).map((s) => s.kind)).toEqual(['deletion']);
    expect(alignPhones([], [{ symbol: 'a' }]).map((s) => s.kind)).toEqual(['insertion']);
  });
});

describe('phoneScoreFromLogPosterior', () => {
  it('maps posteriors 1, 0.1 and 0.01 to 100, 50 and 0', () => {
    expect(phoneScoreFromLogPosterior(0)).toBe(100);
    expect(phoneScoreFromLogPosterior(Math.log(0.1))).toBe(50);
    expect(phoneScoreFromLogPosterior(Math.log(0.01))).toBe(0);
    expect(phoneScoreFromLogPosterior(Math.log(0.0001))).toBe(0);
  });
});

describe('scorePronunciation', () => {
  it('scores a clean utterance near 100', () => {
    const result = scorePronunciation(
      g2p('fatto'),
      timeline([
        ['f', 80, 0.95],
        ['a', 100, 0.95],
        ['t', 180, 0.9],
        ['o', 100, 0.95],
      ]),
    );
    expect(result.phones.map((p) => p.status)).toEqual([
      'correct',
      'correct',
      'correct',
      'correct',
    ]);
    expect(result.phones[2]?.score).toBe(98);
    expect(result.phones[2]?.gop).toBe(0);
    expect(result.score).toBeGreaterThanOrEqual(98);
    expect(result.accuracy).toBe(1);
    expect(result.completeness).toBe(1);
    expect(result.words).toHaveLength(1);
  });

  it('penalises a substitution by remaining mass and phonetic distance', () => {
    const result = scorePronunciation(
      g2p('fatto'),
      timeline([
        ['f', 80],
        ['a', 100],
        ['d', 150, 0.8],
        ['o', 100],
      ]),
    );
    const t = result.phones[2];
    expect(t?.status).toBe('substituted');
    expect(t?.recognized).toBe('d');
    // pₑ = (1 − 0.8) · (1 − 0.35) = 0.13
    expect(t?.logPosterior).toBeCloseTo(Math.log(0.13));
    expect(t?.score).toBe(phoneScoreFromLogPosterior(Math.log(0.13)));
    expect(t?.gop).toBeCloseTo(Math.log(0.13) - Math.log(0.8));
    expect(result.accuracy).toBe(0.75);
  });

  it('uses recognizer posteriors for the expected phone when given', () => {
    const result = scorePronunciation(
      g2p('fatto'),
      timeline([
        ['f', 80],
        ['a', 100],
        ['d', 150, 0.55, { posteriors: { d: 0.55, t: 0.4 } }],
        ['o', 100],
      ]),
    );
    expect(result.phones[2]?.logPosterior).toBeCloseTo(Math.log(0.4));
    expect(result.phones[2]?.score).toBe(phoneScoreFromLogPosterior(Math.log(0.4)));
  });

  it('scores a deleted phone 0 and lowers completeness', () => {
    const result = scorePronunciation(
      g2p('pane'),
      timeline([
        ['p', 80],
        ['a', 120],
        ['n', 80],
      ]),
    );
    expect(result.phones.map((p) => p.status)).toEqual([
      'correct',
      'correct',
      'correct',
      'missing',
    ]);
    expect(result.phones[3]?.score).toBe(0);
    expect(result.completeness).toBe(0.75);
    expect(result.words[0]?.score).toBeLessThan(80);
  });

  it('attributes insertions to words and counts them at half weight', () => {
    const result = scorePronunciation(
      g2p('sport'),
      timeline([
        ['ə', 60, 0.9],
        ['s', 90, 1],
        ['p', 70, 1],
        ['ɔ', 100, 1],
        ['r', 50, 1],
        ['t', 60, 1],
      ]),
    );
    const w = result.words[0];
    expect(w?.insertions).toEqual([0]);
    // 5 phones scored 100 over 5 + 0.5 weighted phones
    expect(w?.score).toBe(Math.round(500 / 5.5));
  });

  it('accepts regional and unknown-quality variants', () => {
    const casa = scorePronunciation(
      g2p('casa'),
      timeline([
        ['k', 80],
        ['a', 100],
        ['s', 90],
        ['a', 100],
      ]),
    );
    expect(casa.accuracy).toBe(1);
    const pena = scorePronunciation(
      g2p('pena'),
      timeline([
        ['p', 80],
        ['ɛ', 100],
        ['n', 90],
        ['a', 100],
      ]),
    );
    expect(pena.accuracy).toBe(1);
    const banca = scorePronunciation(
      g2p('banca'),
      timeline([
        ['b', 80],
        ['a', 100],
        ['n', 60],
        ['k', 90],
        ['a', 100],
      ]),
    );
    expect(banca.accuracy).toBe(1);
  });

  it('weights the utterance score by word length', () => {
    const result = scorePronunciation(
      g2p('la pizza'),
      timeline([
        ['l', 60, 1],
        ['a', 90, 1],
        ['p', 80, 1],
        ['i', 90, 1],
        ['ts', 160, 0.1],
        ['a', 100, 1],
      ]),
    );
    expect(result.words.map((w) => w.score)).toEqual([100, Math.round(350 / 4)]);
    expect(result.score).toBe(Math.round(550 / 6));
  });

  it('accepts a flattened phone list', () => {
    const result = scorePronunciation(
      [{ phoneme: 'a', isLong: false, alternatives: [], wordIndex: 0, phoneIndex: 0 }],
      timeline([['a', 100, 1]]),
    );
    expect(result.score).toBe(100);
  });

  it('returns zeros for an empty recording', () => {
    const result = scorePronunciation(g2p('ciao'), []);
    expect(result.score).toBe(0);
    expect(result.completeness).toBe(0);
  });
});
