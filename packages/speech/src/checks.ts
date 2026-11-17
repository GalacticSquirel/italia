/**
 * Targeted pronunciation checks for the errors that matter most to English
 * speakers learning Italian: consonant length, stress placement, vowel
 * reduction and diphthongisation, and aspirated /p t k/.
 *
 * Checks return feedback as i18n keys with parameters (never prose), so the app
 * can phrase and translate them. All thresholds are initial values to be
 * calibrated against labelled recordings.
 *
 * @packageDocumentation
 */

import type { PronunciationScore, RecognizedSegment } from './align';
import type { G2PResult, PhoneToken, WordG2P } from './g2p';
import type { Phoneme } from './inventory';

/** Every feedback key a check can emit. */
export const FEEDBACK_KEYS = [
  'speech.geminate.ok',
  'speech.geminate.soundedSingle',
  'speech.geminate.borderline',
  'speech.geminate.soundedDouble',
  'speech.geminate.missing',
  'speech.geminate.insufficientData',
  'speech.stress.ok',
  'speech.stress.wrongSyllable',
  'speech.stress.unclear',
  'speech.stress.notApplicable',
  'speech.vowel.finalReduced',
  'speech.vowel.finalDropped',
  'speech.vowel.reduced',
  'speech.vowel.diphthongised',
  'speech.consonant.aspirated',
] as const;

/** A feedback key from {@link FEEDBACK_KEYS}. */
export type FeedbackKey = (typeof FEEDBACK_KEYS)[number];

/** Learner feedback: an i18n key and the values to interpolate. */
export interface Feedback {
  readonly key: FeedbackKey;
  readonly params: Readonly<Record<string, string | number>>;
}

function durationOf(seg: RecognizedSegment): number {
  return seg.closureMs ?? seg.endMs - seg.startMs;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const hi = sorted[mid] ?? 0;
  return sorted.length % 2 === 1 ? hi : ((sorted[mid - 1] ?? hi) + hi) / 2;
}

function lettersOf(result: G2PResult, p: PhoneToken): string {
  return result.text.slice(p.span.start, p.span.end);
}

// ---------------------------------------------------------------------------
// Geminates

/** Thresholds for {@link checkGeminates}, as ratios to the speaker's reference consonant duration. */
export interface GeminateOptions {
  /** A long consonant at or above this ratio is `ok`. Default 1.5. */
  readonly longOkRatio?: number;
  /** A long consonant below this ratio `soundedSingle`; between the two is `borderline`. Default 1.25. */
  readonly singleMaxRatio?: number;
  /** A short consonant at or above this ratio `soundedDouble`. Default 1.9. */
  readonly overlongRatio?: number;
  /** Also check intrinsic geminates (/ʎ ɲ ʃ ts dz/ between vowels). Default false. */
  readonly includeIntrinsic?: boolean;
  /** Also check short intervocalic consonants for over-lengthening. Default true. */
  readonly checkSingles?: boolean;
  /** Minimum number of reference durations needed. Default 2. */
  readonly minReferences?: number;
}

/** Verdict of a consonant-length check. */
export type GeminateVerdict =
  'ok' | 'soundedSingle' | 'borderline' | 'soundedDouble' | 'missing' | 'insufficientData';

/** Result of a consonant-length check for one consonant. */
export interface GeminateCheck {
  readonly wordIndex: number;
  readonly phoneIndex: number;
  readonly phoneme: Phoneme;
  readonly expectedLong: boolean;
  /** Measured duration (closure if given, else segment) over the reference; `null` if not measurable. */
  readonly ratio: number | null;
  readonly verdict: GeminateVerdict;
  readonly feedback: Feedback;
}

/**
 * Consonant-length (gemination) check.
 *
 * The measure is the aligned segment's `closureMs` when the recognizer or an
 * acoustic step supplies it, otherwise the segment duration. To normalise for
 * speaking rate it is divided by a reference: the median measure of the
 * correctly recognised short consonants in the utterance (falling back to the
 * median of all correctly recognised phones when fewer than `minReferences`
 * exist). Italian geminate closures are roughly twice as long as singletons, so:
 *
 * - expected long: ratio ≥ 1.5 → `ok`; < 1.25 → `soundedSingle`; else `borderline`.
 *   A recognizer that itself marks the phone long (`ː` or a repeated label) → `ok`.
 * - expected short (between vowels): ratio ≥ 1.9 or marked long → `soundedDouble`.
 * - not recognised → `missing`; no usable reference → `insufficientData`.
 */
export function checkGeminates(
  result: G2PResult,
  score: PronunciationScore,
  options: GeminateOptions = {},
): GeminateCheck[] {
  const longOk = options.longOkRatio ?? 1.5;
  const singleMax = options.singleMaxRatio ?? 1.25;
  const overlong = options.overlongRatio ?? 1.9;
  const includeIntrinsic = options.includeIntrinsic ?? false;
  const checkSingles = options.checkSingles ?? true;
  const minRefs = options.minReferences ?? 2;

  const tokenOf = (wordIndex: number, phoneIndex: number): PhoneToken | undefined =>
    result.words[wordIndex]?.phonemes[phoneIndex];
  const segOf = (segment: number | null): RecognizedSegment | undefined =>
    segment === null ? undefined : score.segments[segment];

  const shortRefs: number[] = [];
  const allRefs: number[] = [];
  for (const ph of score.phones) {
    const seg = segOf(ph.segment);
    const tok = tokenOf(ph.wordIndex, ph.phoneIndex);
    if (!seg || !tok || ph.status !== 'correct') continue;
    allRefs.push(durationOf(seg));
    if (tok.role === 'consonant' && !tok.isLong && !seg.long) shortRefs.push(durationOf(seg));
  }
  const reference = shortRefs.length >= minRefs ? median(shortRefs) : median(allRefs);
  const usable =
    reference !== null && reference > 0 && Math.max(shortRefs.length, allRefs.length) >= minRefs;

  const checks: GeminateCheck[] = [];
  for (const ph of score.phones) {
    const word = result.words[ph.wordIndex];
    const tok = tokenOf(ph.wordIndex, ph.phoneIndex);
    if (!word || tok?.role !== 'consonant') continue;
    const intrinsic = tok.flags.includes('intrinsicLong');
    const prev = word.phonemes[ph.phoneIndex - 1];
    const next = word.phonemes[ph.phoneIndex + 1];
    const intervocalic =
      prev !== undefined &&
      (prev.role === 'nucleus' || prev.role === 'offGlide') &&
      next !== undefined &&
      (next.role === 'nucleus' || next.role === 'onsetGlide');
    let expectedLong: boolean;
    if (tok.isLong && (!intrinsic || includeIntrinsic)) expectedLong = true;
    else if (!tok.isLong && checkSingles && intervocalic) expectedLong = false;
    else continue;

    const seg = segOf(ph.segment);
    const params = { word: word.text, phoneme: tok.phoneme, letters: lettersOf(result, tok) };
    let verdict: GeminateVerdict;
    let ratio: number | null = null;
    if (!seg || ph.status === 'missing') verdict = 'missing';
    else if (!usable) verdict = 'insufficientData';
    else {
      ratio = Math.round((durationOf(seg) / reference) * 100) / 100;
      if (expectedLong) {
        if (seg.long || ratio >= longOk) verdict = 'ok';
        else if (ratio < singleMax) verdict = 'soundedSingle';
        else verdict = 'borderline';
      } else {
        verdict = seg.long || ratio >= overlong ? 'soundedDouble' : 'ok';
      }
    }
    checks.push({
      wordIndex: ph.wordIndex,
      phoneIndex: ph.phoneIndex,
      phoneme: tok.phoneme,
      expectedLong,
      ratio,
      verdict,
      feedback: {
        key: `speech.geminate.${verdict}`,
        params: ratio === null ? params : { ...params, ratio },
      },
    });
  }
  return checks;
}

// ---------------------------------------------------------------------------
// Stress

/**
 * Acoustic measurements for one syllable, in the word's syllable order.
 * Supply what the audio front end can measure; only the duration is required.
 */
export interface SyllableProsody {
  /** Duration of the syllable nucleus (vowel) in ms; the whole syllable is acceptable if that is all there is. */
  readonly durationMs: number;
  /** Peak or mean intensity of the nucleus, in dB. */
  readonly energyDb?: number;
  /** Peak or mean fundamental frequency of the nucleus, in Hz. */
  readonly f0Hz?: number;
}

/** Options for {@link checkStress}. */
export interface StressOptions {
  /**
   * The word ends a phrase (true for words said in isolation): the final
   * syllable's duration is divided by {@link STRESS_FINAL_LENGTHENING} to
   * discount phrase-final lengthening. Default true.
   */
  readonly phraseFinal?: boolean;
  /** Minimum prominence lead of the detected syllable over the runner-up to call stress misplaced. Default 0.3. */
  readonly unclearMargin?: number;
}

/** Divisor for the duration of a phrase-final syllable. */
export const STRESS_FINAL_LENGTHENING = 1.2;

/** Weights of the prominence cues (Italian stress is cued mainly by duration). */
export const STRESS_CUE_WEIGHTS = { duration: 0.5, energy: 0.3, f0: 0.2 } as const;

/** Verdict of a stress check. */
export type StressVerdict = 'ok' | 'wrongSyllable' | 'unclear' | 'notApplicable';

/** Result of {@link checkStress}. */
export interface StressCheck {
  readonly expectedSyllable: number | null;
  readonly detectedSyllable: number | null;
  /** Prominence per syllable (weighted z-scores). */
  readonly prominence: readonly number[];
  readonly verdict: StressVerdict;
  readonly feedback: Feedback;
}

function zScores(values: readonly number[]): number[] {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
  return values.map((x) => (sd > 0 ? (x - mean) / sd : 0));
}

function syllableText(word: WordG2P, s: number): string {
  const syl = word.syllables[s];
  if (!syl) return '';
  return word.text.slice(syl.span.start - word.span.start, syl.span.end - word.span.start);
}

/**
 * Stress-placement check from per-syllable prosody.
 *
 * Prominence of syllable *s* = `0.5·z(duration) + 0.3·z(energy) + 0.2·z(ln f0)`,
 * with z-scores across the word's syllables and weights renormalised over the
 * cues actually supplied (a cue counts only if every syllable has it). The
 * most prominent syllable is the detected stress. Same as expected → `ok`;
 * otherwise `wrongSyllable` if it leads the runner-up by at least
 * `unclearMargin`, else `unclear`. Unstressed words and monosyllables are
 * `notApplicable`.
 *
 * @throws RangeError if `prosody` does not have one entry per syllable.
 */
export function checkStress(
  word: WordG2P,
  prosody: readonly SyllableProsody[],
  options: StressOptions = {},
): StressCheck {
  const expected = word.stressedSyllable;
  const notApplicable = (): StressCheck => ({
    expectedSyllable: expected,
    detectedSyllable: null,
    prominence: [],
    verdict: 'notApplicable',
    feedback: { key: 'speech.stress.notApplicable', params: { word: word.text } },
  });
  if (expected === null || word.syllables.length < 2) return notApplicable();
  if (prosody.length !== word.syllables.length) {
    throw new RangeError(
      `checkStress: expected ${word.syllables.length} syllable measurements, got ${prosody.length}`,
    );
  }
  const phraseFinal = options.phraseFinal ?? true;
  const margin = options.unclearMargin ?? 0.3;
  const last = prosody.length - 1;
  const durations = prosody.map((p, s) =>
    phraseFinal && s === last ? p.durationMs / STRESS_FINAL_LENGTHENING : p.durationMs,
  );
  const cues: { weight: number; z: number[] }[] = [
    { weight: STRESS_CUE_WEIGHTS.duration, z: zScores(durations) },
  ];
  if (prosody.every((p) => p.energyDb !== undefined)) {
    cues.push({
      weight: STRESS_CUE_WEIGHTS.energy,
      z: zScores(prosody.map((p) => p.energyDb ?? 0)),
    });
  }
  if (prosody.every((p) => p.f0Hz !== undefined && p.f0Hz > 0)) {
    cues.push({
      weight: STRESS_CUE_WEIGHTS.f0,
      z: zScores(prosody.map((p) => Math.log(p.f0Hz ?? 1))),
    });
  }
  const totalWeight = cues.reduce((a, c) => a + c.weight, 0);
  const prominence = prosody.map(
    (_, s) =>
      Math.round((cues.reduce((a, c) => a + c.weight * (c.z[s] ?? 0), 0) / totalWeight) * 1000) /
      1000,
  );
  let detected = 0;
  prominence.forEach((p, s) => {
    if (p > (prominence[detected] ?? -Infinity)) detected = s;
  });
  const runnerUp = Math.max(...prominence.filter((_, s) => s !== detected));
  const lead = (prominence[detected] ?? 0) - runnerUp;
  const params = {
    word: word.text,
    expected: syllableText(word, expected),
    heard: syllableText(word, detected),
  };
  let verdict: StressVerdict;
  if (detected === expected) verdict = 'ok';
  else if (lead >= margin) verdict = 'wrongSyllable';
  else verdict = 'unclear';
  return {
    expectedSyllable: expected,
    detectedSyllable: detected,
    prominence,
    verdict,
    feedback: { key: `speech.stress.${verdict}`, params },
  };
}

/**
 * Per-syllable durations for {@link checkStress} taken from the alignment: the
 * duration of each syllable's aligned nucleus (0 if the nucleus was not
 * recognised). Energy and pitch must come from the audio front end.
 */
export function syllableProsodyFromScore(
  result: G2PResult,
  score: PronunciationScore,
  wordIndex: number,
): SyllableProsody[] {
  const word = result.words[wordIndex];
  if (!word) return [];
  return word.syllables.map((syl) => {
    const nucleus = syl.phonemes.find((i) => word.phonemes[i]?.role === 'nucleus');
    const ph = score.phones.find((p) => p.wordIndex === wordIndex && p.phoneIndex === nucleus);
    const seg = ph?.segment === null || ph === undefined ? undefined : score.segments[ph.segment];
    return { durationMs: seg ? seg.endMs - seg.startMs : 0 };
  });
}

// ---------------------------------------------------------------------------
// Vowels and aspiration

/** Recognised symbols that indicate a reduced (schwa-like or lax) vowel. */
export const REDUCED_VOWELS: ReadonlySet<string> = new Set(['ə', 'ɐ', 'ɜ', 'ɨ', 'ʌ', 'ɪ', 'ʊ']);

const FRONT_MID = new Set<Phoneme>(['e', 'ɛ', 'E']);
const BACK_MID = new Set<Phoneme>(['o', 'ɔ', 'O']);
const FRONT_OFFGLIDES = new Set(['j', 'i', 'ɪ']);
const BACK_OFFGLIDES = new Set(['w', 'u', 'ʊ']);
const DIPHTHONGS = new Set(['eɪ', 'oʊ', 'əʊ']);
const VOICELESS_STOPS = new Set<Phoneme>(['p', 't', 'k']);

/** Voice onset time above which a /p t k/ counts as aspirated (Italian short-lag VOT is about 10–30 ms). */
export const ASPIRATION_VOT_MS = 35;

/** Kind of segmental issue. */
export type SegmentalIssueKind =
  'finalReduced' | 'finalDropped' | 'reduced' | 'diphthongised' | 'aspirated';

/** One segmental issue found by {@link checkSegmentals}. */
export interface SegmentalIssue {
  readonly kind: SegmentalIssueKind;
  readonly wordIndex: number;
  readonly phoneIndex: number;
  readonly phoneme: Phoneme;
  readonly feedback: Feedback;
}

/**
 * Classic English-speaker errors, from the alignment:
 *
 * - **finalReduced / finalDropped**: a word-final vowel of a polysyllable heard
 *   as a reduced vowel (ə, ɐ, ɪ, ...) or not heard at all (*pane* → "pan").
 * - **reduced**: any other unstressed vowel heard as a reduced vowel.
 * - **diphthongised**: an /e ɛ o ɔ/ heard as eɪ/oʊ/əʊ, or followed by an
 *   inserted off-glide (j/i/ɪ after front, w/u/ʊ after back vowels).
 * - **aspirated**: /p t k/ whose segment is marked aspirated (`ʰ`) or whose
 *   `votMs` is at least {@link ASPIRATION_VOT_MS}.
 */
export function checkSegmentals(result: G2PResult, score: PronunciationScore): SegmentalIssue[] {
  const issues: SegmentalIssue[] = [];
  const stepIndexOfExpected = new Map<number, number>();
  score.alignment.forEach((step, k) => {
    if (step.expected !== null) stepIndexOfExpected.set(step.expected, k);
  });
  for (const ph of score.phones) {
    const word = result.words[ph.wordIndex];
    const tok = word?.phonemes[ph.phoneIndex];
    if (!word || !tok) continue;
    const seg = ph.segment === null ? undefined : score.segments[ph.segment];
    const add = (kind: SegmentalIssueKind, extra: Record<string, string | number> = {}): void => {
      const key: FeedbackKey =
        kind === 'aspirated' ? 'speech.consonant.aspirated' : `speech.vowel.${kind}`;
      issues.push({
        kind,
        wordIndex: ph.wordIndex,
        phoneIndex: ph.phoneIndex,
        phoneme: tok.phoneme,
        feedback: {
          key,
          params: {
            word: word.text,
            phoneme: tok.phoneme,
            letters: result.text.slice(tok.span.start, tok.span.end),
            ...extra,
          },
        },
      });
    };

    if (tok.role === 'nucleus') {
      const isFinal = ph.phoneIndex === word.phonemes.length - 1 && word.syllables.length >= 2;
      const reduced =
        seg !== undefined && REDUCED_VOWELS.has(seg.symbol) && ph.status !== 'correct';
      if (isFinal && ph.status === 'missing') add('finalDropped');
      else if (isFinal && reduced) add('finalReduced', { heard: seg.symbol });
      else if (!tok.stressed && reduced) add('reduced', { heard: seg.symbol });

      const front = FRONT_MID.has(tok.phoneme);
      const back = BACK_MID.has(tok.phoneme);
      if ((front || back) && seg) {
        let diph = DIPHTHONGS.has(seg.symbol);
        const k = stepIndexOfExpected.get(ph.expectedIndex);
        const nextStep = k === undefined ? undefined : score.alignment[k + 1];
        if (!diph && nextStep?.kind === 'insertion' && nextStep.recognized !== null) {
          const inserted = score.segments[nextStep.recognized]?.symbol;
          if (inserted !== undefined) {
            diph = front ? FRONT_OFFGLIDES.has(inserted) : BACK_OFFGLIDES.has(inserted);
          }
        }
        if (diph) add('diphthongised');
      }
    } else if (VOICELESS_STOPS.has(tok.phoneme) && seg) {
      const vot = seg.votMs;
      if (seg.aspirated || (vot !== undefined && vot >= ASPIRATION_VOT_MS)) {
        add('aspirated', vot === undefined ? {} : { votMs: vot });
      }
    }
  }
  return issues;
}
