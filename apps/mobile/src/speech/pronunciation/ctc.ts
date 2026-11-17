/**
 * Greedy CTC decoding of a phoneme recognizer's frame logits into timed phone
 * segments ({@link RecognizedPhone}) for `@italia/speech`'s scorer.
 *
 * Pure TypeScript: the ML runtime only produces the logits matrix.
 *
 * 1. Softmax per frame; the best label per frame.
 * 2. Runs of the same non-blank label become one token (CTC collapse); a
 *    blank between two equal labels separates two tokens, which the scorer
 *    then reads as a long consonant.
 * 3. Token boundaries: CTC posteriors are "peaky" (a phone often fires on one
 *    or two frames), so each boundary is moved to the middle of the blank gap
 *    between neighbouring tokens, at most `maxExtendMs` from the token. This
 *    keeps segments contiguous across short gaps and gives durations that
 *    track the phones, while long pauses stay pauses. Thresholds are initial
 *    values to calibrate against labelled recordings.
 * 4. Modifier labels (`ː` length) join the phone before them; diacritics in
 *    `dropLabels` are removed; word delimiters end a word; affricate pairs
 *    within a word (`t` + `ʃ`) are merged (`tʃ`).
 * 5. `prob` is the token label's mean posterior over its frames, and
 *    `posteriors` holds the mean posteriors of the next best labels over the
 *    same frames (for goodness-of-pronunciation scores).
 */
import type { RecognizedPhone } from '@italia/speech';

/** Decoder configuration. */
export interface CtcConfig {
  /** Output labels, by index. */
  labels: readonly string[];
  /** Index of the CTC blank. */
  blank: number;
  /** Duration of one output frame in milliseconds. */
  frameMs: number;
  /** Index of the word delimiter, if the model has one. */
  wordDelimiter?: number;
  /** Labels that modify the previous phone (appended to it), for example `ː`. */
  modifiers?: readonly string[];
  /** Labels removed from the output (special tokens, redundant diacritics). */
  dropLabels?: readonly string[];
  /** Pairs merged into one phone within a word, for example `t` + `ʃ` → `tʃ`. */
  merges?: Readonly<Record<string, string>>;
  /** Furthest a boundary moves into a blank gap. Defaults to 60 ms. */
  maxExtendMs?: number;
  /** Other labels kept in `posteriors`. Defaults to 3. */
  topK?: number;
}

interface Token {
  label: number;
  first: number;
  last: number;
  /** Sum of each label's posterior over the token's frames. */
  sums: Float64Array;
}

/** Softmax of each frame of a `[frames × labels]` row-major logits matrix. */
export function softmaxFrames(logits: Float32Array, labels: number): Float32Array {
  if (labels <= 0 || logits.length % labels !== 0) {
    throw new RangeError('logits length must be a multiple of the label count');
  }
  const out = new Float32Array(logits.length);
  for (let f = 0; f < logits.length / labels; f++) {
    const base = f * labels;
    let max = -Infinity;
    for (let k = 0; k < labels; k++) max = Math.max(max, logits[base + k] ?? -Infinity);
    let sum = 0;
    for (let k = 0; k < labels; k++) {
      const e = Math.exp((logits[base + k] ?? -Infinity) - max);
      out[base + k] = e;
      sum += e;
    }
    for (let k = 0; k < labels; k++) out[base + k] = (out[base + k] ?? 0) / sum;
  }
  return out;
}

function argmax(probs: Float32Array, base: number, labels: number): number {
  let best = 0;
  let bestP = -1;
  for (let k = 0; k < labels; k++) {
    const p = probs[base + k] ?? 0;
    if (p > bestP) {
      bestP = p;
      best = k;
    }
  }
  return best;
}

/**
 * Decode `[frames × labels]` logits (row-major) into phone segments. See the
 * module documentation.
 */
export function ctcGreedyDecode(logits: Float32Array, config: CtcConfig): RecognizedPhone[] {
  const nLabels = config.labels.length;
  const probs = softmaxFrames(logits, nLabels);
  const frames = probs.length / nLabels;
  const maxExtend = (config.maxExtendMs ?? 60) / config.frameMs;
  const topK = config.topK ?? 3;
  const modifiers = new Set(config.modifiers ?? []);
  const drop = new Set(config.dropLabels ?? []);
  const merges = config.merges ?? {};

  // 1–2. Collapse frames into tokens (blanks separate tokens).
  const tokens: Token[] = [];
  let prev = config.blank;
  for (let f = 0; f < frames; f++) {
    const base = f * nLabels;
    const label = argmax(probs, base, nLabels);
    if (label !== config.blank) {
      let token = tokens.at(-1);
      if (label !== prev || !token) {
        token = { label, first: f, last: f, sums: new Float64Array(nLabels) };
        tokens.push(token);
      }
      token.last = f;
      for (let k = 0; k < nLabels; k++)
        token.sums[k] = (token.sums[k] ?? 0) + (probs[base + k] ?? 0);
    }
    prev = label;
  }

  // 3. Boundaries in the middle of blank gaps, capped.
  const bounds = tokens.map((t, i) => {
    const before = tokens[i - 1];
    const after = tokens[i + 1];
    const start =
      before === undefined
        ? t.first
        : Math.max(t.first - maxExtend, (before.last + 1 + t.first) / 2);
    const end =
      after === undefined
        ? t.last + 1
        : Math.min(t.last + 1 + maxExtend, (t.last + 1 + after.first) / 2);
    return { startMs: Math.round(start * config.frameMs), endMs: Math.round(end * config.frameMs) };
  });

  // 4–5. Labels, modifiers, word boundaries and merges.
  const out: (RecognizedPhone & { word: number })[] = [];
  let word = 0;
  tokens.forEach((t, i) => {
    const label = config.labels[t.label] ?? '';
    const { startMs, endMs } = bounds[i] ?? { startMs: 0, endMs: 0 };
    if (t.label === config.wordDelimiter) {
      word += 1;
      return;
    }
    if (drop.has(label) || label === '') return;
    const count = t.last - t.first + 1;
    const prob = (t.sums[t.label] ?? 0) / count;
    const last = out.at(-1);
    if (modifiers.has(label)) {
      if (last?.word === word) {
        out[out.length - 1] = {
          ...last,
          phone: last.phone + label,
          endMs,
          prob: Math.min(last.prob, prob),
        };
      }
      return;
    }
    const merged = last?.word === word ? merges[last.phone + label] : undefined;
    if (last && merged !== undefined) {
      out[out.length - 1] = { ...last, phone: merged, endMs, prob: (last.prob + prob) / 2 };
      return;
    }
    const others: [string, number][] = [];
    for (let k = 0; k < nLabels; k++) {
      if (k === t.label || k === config.blank) continue;
      const name = config.labels[k];
      if (name === undefined || drop.has(name) || k === config.wordDelimiter) continue;
      others.push([name, (t.sums[k] ?? 0) / count]);
    }
    others.sort((a, b) => b[1] - a[1]);
    out.push({
      phone: label,
      startMs,
      endMs,
      prob,
      posteriors: Object.fromEntries([[label, prob], ...others.slice(0, topK)]),
      word,
    });
  });
  return out.map(({ word: _word, ...phone }) => phone);
}
