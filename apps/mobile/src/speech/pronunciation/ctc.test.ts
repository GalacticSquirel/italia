import { scorePronunciation, g2p } from '@italia/speech';

import { ctcGreedyDecode, softmaxFrames, type CtcConfig } from './ctc';
import { PHONEMIZER_CTC, PHONEMIZER_LABELS } from './phonemizer';

/** Logits for a frame sequence: each frame is a label (or [label, confidence]). */
function logitsFor(
  labels: readonly string[],
  frames: readonly (string | [string, number] | [string, number, string])[],
): Float32Array {
  const out = new Float32Array(frames.length * labels.length).fill(-5);
  frames.forEach((frame, f) => {
    const [name, logit, runnerUp] = typeof frame === 'string' ? [frame, 5, undefined] : frame;
    const k = labels.indexOf(name);
    if (k < 0) throw new Error(`no label ${name}`);
    out[f * labels.length + k] = logit;
    if (runnerUp !== undefined) out[f * labels.length + labels.indexOf(runnerUp)] = logit - 1;
  });
  return out;
}

const TOY: CtcConfig = {
  labels: ['_', '|', 'a', 't', 'ʃ', 'ː', 'x'],
  blank: 0,
  wordDelimiter: 1,
  frameMs: 20,
  modifiers: ['ː'],
  dropLabels: ['x'],
  merges: { tʃ: 'tʃ' },
  maxExtendMs: 40,
};

describe('softmaxFrames', () => {
  it('normalises each frame', () => {
    const p = softmaxFrames(Float32Array.of(0, 0, Math.log(3), 0), 2);
    expect(p[0]).toBeCloseTo(0.5);
    expect(p[2]).toBeCloseTo(0.75);
    expect(() => softmaxFrames(Float32Array.of(1, 2, 3), 2)).toThrow(RangeError);
  });
});

describe('ctcGreedyDecode', () => {
  it('collapses repeats, drops blanks and times segments at gap midpoints', () => {
    const phones = ctcGreedyDecode(logitsFor(TOY.labels, ['_', 'a', 'a', '_', '_', 't', '_']), TOY);
    expect(phones.map((p) => [p.phone, p.startMs, p.endMs])).toEqual([
      ['a', 20, 80],
      ['t', 80, 120],
    ]);
    expect(phones[0]?.prob).toBeGreaterThan(0.9);
    expect(phones[0]?.prob).toBeLessThanOrEqual(1);
  });

  it('keeps a blank-separated repeat as two segments (a long consonant)', () => {
    const phones = ctcGreedyDecode(logitsFor(TOY.labels, ['a', 't', '_', 't', 'a']), TOY);
    expect(phones.map((p) => p.phone)).toEqual(['a', 't', 't', 'a']);
    expect(phones[1]?.endMs).toBe(phones[2]?.startMs);
  });

  it('caps how far a boundary moves into a long pause', () => {
    const frames = ['a', ...Array<string>(20).fill('_'), 'a'];
    const [first, second] = ctcGreedyDecode(logitsFor(TOY.labels, frames), TOY);
    expect(first?.endMs).toBe(20 + 40);
    expect(second?.startMs).toBe(21 * 20 - 40);
  });

  it('attaches length marks, merges affricates within a word and drops specials', () => {
    const phones = ctcGreedyDecode(
      logitsFor(TOY.labels, ['a', 't', 'ː', 'x', 'a', '|', 't', 'ʃ', 'a', '|', 't', '|', 'ʃ']),
      TOY,
    );
    expect(phones.map((p) => p.phone)).toEqual(['a', 'tː', 'a', 'tʃ', 'a', 't', 'ʃ']);
  });

  it('reports the runner-up posteriors for goodness of pronunciation', () => {
    const [phone] = ctcGreedyDecode(logitsFor(TOY.labels, [['a', 2, 't']]), TOY);
    expect(phone?.posteriors?.a).toBeCloseTo(phone?.prob ?? 0);
    expect(phone?.posteriors?.t).toBeGreaterThan(0.2);
    expect(Object.keys(phone?.posteriors ?? {})).not.toContain('_');
    expect(Object.keys(phone?.posteriors ?? {})).not.toContain('x');
  });

  it('returns nothing for silence', () => {
    expect(ctcGreedyDecode(logitsFor(TOY.labels, ['_', '_']), TOY)).toEqual([]);
  });

  it('decodes phonemizer output well enough to score "fatto" as a geminate', () => {
    expect(PHONEMIZER_LABELS).toHaveLength(39);
    const frames = ['[PAD]', 'f', 'a', 'a', 't', '[PAD]', '[PAD]', '[PAD]', 't', 'o', '[PAD]'];
    const phones = ctcGreedyDecode(logitsFor(PHONEMIZER_LABELS, frames), PHONEMIZER_CTC);
    expect(phones.map((p) => p.phone)).toEqual(['f', 'a', 't', 't', 'o']);
    const score = scorePronunciation(g2p('fatto'), phones);
    expect(score.accuracy).toBe(1);
    expect(score.segments.find((s) => s.symbol === 't')?.long).toBe(true);
  });
});
