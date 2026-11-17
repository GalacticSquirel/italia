/**
 * Alignment of the expected phoneme sequence (from {@link g2p}) with the output
 * of a phoneme recognizer, and GOP-style scores per phoneme, word and utterance.
 *
 * ## Formulas
 *
 * - **Alignment**: weighted edit distance. A recognised phone that equals the
 *   expected phoneme or one of its accepted alternatives costs 0; any other
 *   substitution costs {@link recognizedCost} (phonetic-feature distance, at most
 *   1); deletions and insertions cost {@link INDEL_COST} (1). Ties prefer
 *   substitution, then deletion.
 * - **Posterior of the expected phone** `pₑ` for an aligned segment: the
 *   segment's `posteriors[expected]` when the recognizer provides it; otherwise
 *   the segment's `prob` for a match, and `(1 − prob) · (1 − cost)` for a
 *   substitution (the probability mass not on the recognised phone, discounted
 *   by phonetic distance). `pₑ` is floored at {@link MIN_POSTERIOR}.
 * - **Log posterior** `LPP = ln pₑ` and **GOP** `= LPP − ln p_best`, where
 *   `p_best` is the highest posterior in the segment (so GOP ≤ 0, and 0 when
 *   the expected phone is the recognizer's best guess).
 * - **Phone score** `= 100 · clamp(1 + LPP / ln(1/P₀), 0, 1)` with
 *   `P₀ =` {@link ZERO_SCORE_POSTERIOR} (0.01): a posterior of 1 scores 100, 0.1
 *   scores 50, 0.01 or less scores 0. A deleted phone scores 0.
 * - **Word score** `= Σ phoneScores / (N + w·I)`, where `N` is the word's phone
 *   count, `I` the inserted phones attributed to it and `w =`
 *   {@link INSERTION_WEIGHT} (0.5).
 * - **Utterance score**: the mean of word scores weighted by `N + w·I`
 *   (equivalently, all phone scores over all weighted phones). **Accuracy** is
 *   the share of expected phones recognised correctly; **completeness** the
 *   share not deleted.
 *
 * All scores are guidance for the learner, not a gate, and the constants are
 * initial values to be calibrated against labelled recordings.
 *
 * @packageDocumentation
 */

import { expectedPhones, type ExpectedPhone, type G2PResult } from './g2p';
import {
  INDEL_COST,
  isConsonant,
  isPhoneme,
  normalizePhone,
  recognizedCost,
  type Phoneme,
  type RecognizedSymbol,
} from './inventory';

/**
 * One phone segment as a CTC phoneme recognizer produces it after greedy or
 * beam decoding with frame timestamps.
 */
export interface RecognizedPhone {
  /** Phone label (IPA; common aliases such as ASCII `g`, `tː`, `pʰ` are normalised). */
  readonly phone: string;
  /** Segment start, milliseconds from the start of the recording. */
  readonly startMs: number;
  /** Segment end, milliseconds (exclusive). */
  readonly endMs: number;
  /** Mean posterior of `phone` over the segment's frames, in (0, 1]. */
  readonly prob: number;
  /** Optional mean posteriors of other labels over the same frames (top-k is enough). */
  readonly posteriors?: Readonly<Record<string, number>>;
  /** Optional closure duration for stops and affricates, from an acoustic measurement. */
  readonly closureMs?: number;
  /** Optional voice onset time for stops, in milliseconds. */
  readonly votMs?: number;
}

/** A recognised segment after normalisation and merging of repeated consonants. */
export interface RecognizedSegment {
  readonly symbol: RecognizedSymbol;
  readonly startMs: number;
  readonly endMs: number;
  readonly prob: number;
  readonly posteriors: Readonly<Record<string, number>>;
  /** Marked long by the recognizer (`ː`) or made of repeated identical consonants. */
  readonly long: boolean;
  /** Marked aspirated by the recognizer (`ʰ`). */
  readonly aspirated: boolean;
  /** Label outside the inventory and the known foreign symbols. */
  readonly unknown: boolean;
  /** Indices of the input phones merged into this segment. */
  readonly sources: readonly number[];
  readonly closureMs?: number;
  readonly votMs?: number;
}

/** One step of the alignment. */
export interface AlignmentStep {
  readonly kind: 'match' | 'substitution' | 'deletion' | 'insertion';
  /** Index into the expected phones, or `null` for an insertion. */
  readonly expected: number | null;
  /** Index into the recognised segments, or `null` for a deletion. */
  readonly recognized: number | null;
  readonly cost: number;
}

/** Score of one expected phone. */
export interface PhoneScore {
  readonly expectedIndex: number;
  readonly wordIndex: number;
  readonly phoneIndex: number;
  readonly phoneme: Phoneme;
  readonly status: 'correct' | 'substituted' | 'missing';
  /** The recognised symbol aligned to this phone, if any. */
  readonly recognized: RecognizedSymbol | null;
  /** Index of the aligned segment, if any. */
  readonly segment: number | null;
  /** `ln pₑ` (see the module docs). */
  readonly logPosterior: number;
  /** `ln pₑ − ln p_best`, at most 0. */
  readonly gop: number;
  /** 0–100. */
  readonly score: number;
}

/** Score of one word. */
export interface WordScore {
  readonly wordIndex: number;
  /** 0–100. */
  readonly score: number;
  /** Indices into {@link PronunciationScore.phones}. */
  readonly phones: readonly number[];
  /** Recognised phones inserted within or right after the word. */
  readonly insertions: readonly number[];
}

/** Result of {@link scorePronunciation}. */
export interface PronunciationScore {
  readonly segments: readonly RecognizedSegment[];
  readonly alignment: readonly AlignmentStep[];
  readonly phones: readonly PhoneScore[];
  readonly words: readonly WordScore[];
  /** 0–100. */
  readonly score: number;
  /** 0–1: share of expected phones recognised correctly. */
  readonly accuracy: number;
  /** 0–1: share of expected phones not deleted. */
  readonly completeness: number;
}

/** Posterior at or below which a phone scores 0. */
export const ZERO_SCORE_POSTERIOR = 0.01;
/** Floor applied to posteriors before taking logs. */
export const MIN_POSTERIOR = 1e-4;
/** Weight of an inserted phone in the word-score denominator. */
export const INSERTION_WEIGHT = 0.5;

/**
 * Normalise recognizer output: map labels onto the inventory, drop silence and
 * padding, and merge runs of the same consonant (a CTC recognizer often emits a
 * long consonant twice) into one long segment whose `prob` is the mean.
 */
export function prepareSegments(phones: readonly RecognizedPhone[]): RecognizedSegment[] {
  const out: RecognizedSegment[] = [];
  phones.forEach((p, i) => {
    const n = normalizePhone(p.phone);
    if (n.symbol === null) return;
    const prev = out.at(-1);
    if (
      prev?.symbol === n.symbol &&
      isPhoneme(n.symbol) &&
      isConsonant(n.symbol) &&
      prev.endMs >= p.startMs - 1
    ) {
      const count = prev.sources.length + 1;
      out[out.length - 1] = {
        ...prev,
        endMs: p.endMs,
        prob: (prev.prob * prev.sources.length + p.prob) / count,
        long: true,
        aspirated: prev.aspirated || n.aspirated,
        sources: [...prev.sources, i],
      };
      return;
    }
    const segment: RecognizedSegment = {
      symbol: n.symbol,
      startMs: p.startMs,
      endMs: p.endMs,
      prob: p.prob,
      posteriors: p.posteriors ?? {},
      long: n.long,
      aspirated: n.aspirated,
      unknown: n.unknown,
      sources: [i],
      ...(p.closureMs !== undefined ? { closureMs: p.closureMs } : {}),
      ...(p.votMs !== undefined ? { votMs: p.votMs } : {}),
    };
    out.push(segment);
  });
  return out;
}

/** True if a recognised symbol counts as the expected phone (identical or an accepted alternative). */
export function isAcceptable(
  expected: Pick<ExpectedPhone, 'phoneme' | 'alternatives'>,
  symbol: string,
): boolean {
  return (
    symbol === expected.phoneme || (expected.alternatives as readonly string[]).includes(symbol)
  );
}

/** Weighted edit-distance alignment (see the module docs for costs). */
export function alignPhones(
  expected: readonly Pick<ExpectedPhone, 'phoneme' | 'alternatives'>[],
  segments: readonly Pick<RecognizedSegment, 'symbol'>[],
): AlignmentStep[] {
  const n = expected.length;
  const m = segments.length;
  const sub = (i: number, j: number): number => {
    const e = expected[i];
    const r = segments[j];
    if (!e || !r) return Infinity;
    return isAcceptable(e, r.symbol) ? 0 : recognizedCost(e.phoneme, r.symbol);
  };
  const d: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  const at = (i: number, j: number): number => d[i]?.[j] ?? Infinity;
  for (let i = 0; i <= n; i++) {
    const row = d[i];
    if (!row) continue;
    for (let j = 0; j <= m; j++) {
      if (i === 0) row[j] = j * INDEL_COST;
      else if (j === 0) row[j] = i * INDEL_COST;
      else
        row[j] = Math.min(
          at(i - 1, j - 1) + sub(i - 1, j - 1),
          at(i - 1, j) + INDEL_COST,
          at(i, j - 1) + INDEL_COST,
        );
    }
  }
  const steps: AlignmentStep[] = [];
  let i = n;
  let j = m;
  const EPS = 1e-9;
  while (i > 0 || j > 0) {
    const here = at(i, j);
    if (i > 0 && j > 0) {
      const c = sub(i - 1, j - 1);
      if (Math.abs(at(i - 1, j - 1) + c - here) < EPS) {
        steps.push({
          kind: c === 0 ? 'match' : 'substitution',
          expected: i - 1,
          recognized: j - 1,
          cost: c,
        });
        i--;
        j--;
        continue;
      }
    }
    if (i > 0 && Math.abs(at(i - 1, j) + INDEL_COST - here) < EPS) {
      steps.push({ kind: 'deletion', expected: i - 1, recognized: null, cost: INDEL_COST });
      i--;
      continue;
    }
    steps.push({ kind: 'insertion', expected: null, recognized: j - 1, cost: INDEL_COST });
    j--;
  }
  return steps.reverse();
}

/** Map a log posterior to a 0–100 phone score (see the module docs). */
export function phoneScoreFromLogPosterior(logPosterior: number): number {
  const scale = Math.log(1 / ZERO_SCORE_POSTERIOR);
  return Math.round(100 * Math.min(1, Math.max(0, 1 + logPosterior / scale)));
}

/**
 * Align and score an utterance.
 *
 * @param expected - A {@link G2PResult} or an already flattened phone list.
 * @param recognized - The recognizer's phone segments.
 */
export function scorePronunciation(
  expected: G2PResult | readonly ExpectedPhone[],
  recognized: readonly RecognizedPhone[],
): PronunciationScore {
  const exp: readonly ExpectedPhone[] = Array.isArray(expected)
    ? (expected as readonly ExpectedPhone[])
    : expectedPhones(expected as G2PResult);
  const segments = prepareSegments(recognized);
  const alignment = alignPhones(exp, segments);

  const phones: PhoneScore[] = [];
  const insertionsByWord = new Map<number, number[]>();
  let lastWord = exp[0]?.wordIndex ?? 0;
  const pendingLeading: number[] = [];
  for (const step of alignment) {
    if (step.kind === 'insertion') {
      if (step.recognized === null) continue;
      if (phones.length === 0) pendingLeading.push(step.recognized);
      else
        insertionsByWord.set(lastWord, [
          ...(insertionsByWord.get(lastWord) ?? []),
          step.recognized,
        ]);
      continue;
    }
    if (step.expected === null) continue;
    const e = exp[step.expected];
    if (!e) continue;
    lastWord = e.wordIndex;
    const base = {
      expectedIndex: step.expected,
      wordIndex: e.wordIndex,
      phoneIndex: e.phoneIndex,
      phoneme: e.phoneme,
    };
    if (step.kind === 'deletion' || step.recognized === null) {
      const lpp = Math.log(MIN_POSTERIOR);
      phones.push({
        ...base,
        status: 'missing',
        recognized: null,
        segment: null,
        logPosterior: lpp,
        gop: lpp,
        score: 0,
      });
      continue;
    }
    const seg = segments[step.recognized];
    if (!seg) continue;
    const pBest = Math.max(seg.prob, ...Object.values(seg.posteriors));
    const fromPosteriors = [e.phoneme, ...e.alternatives]
      .map((ph) => seg.posteriors[ph])
      .filter((x): x is number => x !== undefined);
    let pe: number;
    if (fromPosteriors.length > 0) pe = Math.max(...fromPosteriors);
    else if (step.kind === 'match') pe = seg.prob;
    else pe = (1 - seg.prob) * (1 - step.cost);
    if (step.kind === 'match') pe = Math.max(pe, seg.prob);
    pe = Math.max(MIN_POSTERIOR, Math.min(1, pe));
    const lpp = Math.log(pe);
    phones.push({
      ...base,
      status: step.kind === 'match' ? 'correct' : 'substituted',
      recognized: seg.symbol,
      segment: step.recognized,
      logPosterior: lpp,
      gop: Math.min(0, lpp - Math.log(Math.max(MIN_POSTERIOR, pBest))),
      score: phoneScoreFromLogPosterior(lpp),
    });
  }
  if (pendingLeading.length > 0) {
    const first = exp[0]?.wordIndex ?? 0;
    insertionsByWord.set(first, [...pendingLeading, ...(insertionsByWord.get(first) ?? [])]);
  }

  const wordIndices = [...new Set(exp.map((e) => e.wordIndex))];
  let total = 0;
  let weight = 0;
  const words: WordScore[] = wordIndices.map((wordIndex) => {
    const idx = phones.flatMap((p, k) => (p.wordIndex === wordIndex ? [k] : []));
    const ins = insertionsByWord.get(wordIndex) ?? [];
    const sum = idx.reduce((s, k) => s + (phones[k]?.score ?? 0), 0);
    const w = idx.length + INSERTION_WEIGHT * ins.length;
    total += sum;
    weight += w;
    return { wordIndex, score: w > 0 ? Math.round(sum / w) : 0, phones: idx, insertions: ins };
  });
  const n = phones.length;
  return {
    segments,
    alignment,
    phones,
    words,
    score: weight > 0 ? Math.round(total / weight) : 0,
    accuracy: n > 0 ? phones.filter((p) => p.status === 'correct').length / n : 0,
    completeness: n > 0 ? phones.filter((p) => p.status !== 'missing').length / n : 0,
  };
}
