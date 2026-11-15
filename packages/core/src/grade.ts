import { diffStrings, osaDistance, type DiffSegment } from './edit-distance';
import { accentKey, normaliseAnswer } from './normalise';
import type { CardKind, PromptMode, Rating } from './types';

/**
 * How an answer compares with the accepted answers:
 *
 * - `exact`: matches after normalisation
 * - `accent_only`: right letters, accents wrong or missing (correct, flagged)
 * - `typo`: within the typo allowance (correct, flagged)
 * - `wrong`: none of the above
 */
export type GradeVerdict = 'exact' | 'accent_only' | 'typo' | 'wrong';

/** Result of {@link gradeAnswer}. */
export interface GradeResult {
  verdict: GradeVerdict;
  /** True for every verdict except `wrong`. */
  correct: boolean;
  /** True when only accents (or a vowel-apostrophe accent) were wrong. */
  accentOnly: boolean;
  /**
   * Edits (insert, delete, substitute or swap two letters) between the answer
   * and the matched answer, ignoring accents. 0 for `exact` and `accent_only`.
   */
  typoCount: number;
  /** The accepted answer the result refers to (the closest one when wrong). */
  matched: string;
  /** The learner's answer after {@link normaliseAnswer}. */
  normalisedAnswer: string;
  /** `matched` after {@link normaliseAnswer}. */
  normalisedExpected: string;
  /** Alignment of `normalisedAnswer` against `normalisedExpected`, for highlighting. */
  diff: DiffSegment[];
}

/** Options for {@link gradeAnswer}. */
export interface GradeOptions {
  /**
   * One typo is tolerated per this many characters of the expected answer
   * (rounded down), so 8 allows none below 8 characters, one from 8 to 15,
   * and so on. Defaults to {@link DEFAULT_CHARS_PER_TYPO}.
   */
  charsPerTypo?: number;
}

/** Typed answers tolerate one typo per 8 characters. */
export const DEFAULT_CHARS_PER_TYPO = 8;

/**
 * Spoken answers are graded from a speech-to-text transcript, whose
 * spelling errors are not the learner's, so they tolerate one per 5.
 */
export const DEFAULT_SPOKEN_CHARS_PER_TYPO = 5;

const VERDICT_RANK = {
  exact: 0,
  accent_only: 1,
  typo: 2,
  wrong: 3,
} as const satisfies Record<GradeVerdict, number>;

function gradeOne(answer: string, accepted: string, charsPerTypo: number): GradeResult {
  const given = normaliseAnswer(answer);
  const expected = normaliseAnswer(accepted);
  const givenKey = accentKey(given);
  const expectedKey = accentKey(expected);

  let verdict: GradeVerdict;
  let typoCount = 0;
  if (given.length > 0 && given === expected) {
    verdict = 'exact';
  } else if (given.length > 0 && givenKey === expectedKey) {
    verdict = 'accent_only';
  } else {
    typoCount = osaDistance(givenKey, expectedKey);
    const allowed = Math.floor(Array.from(expectedKey).length / charsPerTypo);
    verdict = given.length > 0 && typoCount <= allowed ? 'typo' : 'wrong';
  }

  return {
    verdict,
    correct: verdict !== 'wrong',
    accentOnly: verdict === 'accent_only',
    typoCount,
    matched: accepted,
    normalisedAnswer: given,
    normalisedExpected: expected,
    diff: diffStrings(given, expected),
  };
}

/**
 * Grade an answer against one or more accepted answers and return the best
 * match (exact, then accent-only, then fewest typos; ties go to the earlier
 * accepted answer).
 *
 * @throws RangeError when `accepted` is empty or `charsPerTypo` is not positive
 */
export function gradeAnswer(
  answer: string,
  accepted: readonly string[],
  options: GradeOptions = {},
): GradeResult {
  const charsPerTypo = options.charsPerTypo ?? DEFAULT_CHARS_PER_TYPO;
  if (!(charsPerTypo > 0)) {
    throw new RangeError('charsPerTypo must be positive');
  }
  let best: GradeResult | undefined;
  for (const candidate of accepted) {
    const result = gradeOne(answer, candidate, charsPerTypo);
    if (
      best === undefined ||
      VERDICT_RANK[result.verdict] < VERDICT_RANK[best.verdict] ||
      (result.verdict === best.verdict && result.typoCount < best.typoCount)
    ) {
      best = result;
    }
  }
  if (best === undefined) {
    throw new RangeError('accepted must contain at least one answer');
  }
  return best;
}

/**
 * Latency at or under which an exact answer is rated `easy`, in
 * milliseconds, per prompt mode and card kind. For typed answers latency runs
 * from prompt shown to answer submitted; for spoken answers, to the end of
 * speech.
 */
export type EasyLatencyThresholds = Record<PromptMode, Record<CardKind, number>>;

/**
 * Default easy-latency thresholds. Starting values to be calibrated from
 * review logs: typed thresholds allow for typing time, so longer answers get
 * longer thresholds.
 */
export const DEFAULT_EASY_LATENCY_MS: EasyLatencyThresholds = {
  typed: {
    recognition: 3_000,
    cloze_production: 6_000,
    grammar_cloze: 7_000,
    dictation: 12_000,
    sentence_production: 15_000,
    spoken_prompt: 6_000,
    minimal_pair: 2_500,
  },
  spoken: {
    recognition: 3_000,
    cloze_production: 3_500,
    grammar_cloze: 4_000,
    dictation: 6_000,
    sentence_production: 6_000,
    spoken_prompt: 4_000,
    minimal_pair: 2_000,
  },
};

/** The context {@link ratingFor} needs besides the grade. */
export interface RatingContext {
  kind: CardKind;
  /** Response time in milliseconds. */
  latencyMs: number;
  /** Defaults to `typed`. */
  mode?: PromptMode;
}

/**
 * Map a grade to an FSRS rating: wrong is `again`; accent-only or a
 * tolerated typo is `hard`; exact is `easy` when at or under the kind's
 * latency threshold, otherwise `good`.
 *
 * @throws RangeError when `latencyMs` is negative or not finite
 */
export function ratingFor(
  grade: GradeResult,
  context: RatingContext,
  thresholds: EasyLatencyThresholds = DEFAULT_EASY_LATENCY_MS,
): Rating {
  if (!(Number.isFinite(context.latencyMs) && context.latencyMs >= 0)) {
    throw new RangeError('latencyMs must be a non-negative number');
  }
  switch (grade.verdict) {
    case 'wrong':
      return 'again';
    case 'accent_only':
    case 'typo':
      return 'hard';
    case 'exact':
      return context.latencyMs <= thresholds[context.mode ?? 'typed'][context.kind]
        ? 'easy'
        : 'good';
  }
}

/** Configuration shared by {@link gradeTyped} and {@link gradeSpoken}. */
export interface GradingConfig {
  /** Overrides the mode's default typo allowance. */
  charsPerTypo?: number;
  thresholds?: EasyLatencyThresholds;
}

/** Input to {@link gradeTyped}. */
export interface TypedResponse {
  answer: string;
  accepted: readonly string[];
  kind: CardKind;
  latencyMs: number;
}

/** A grade and the rating it maps to. */
export interface GradedResponse {
  grade: GradeResult;
  rating: Rating;
}

/** Grade a typed answer and map it to a rating. */
export function gradeTyped(response: TypedResponse, config: GradingConfig = {}): GradedResponse {
  const grade = gradeAnswer(response.answer, response.accepted, {
    charsPerTypo: config.charsPerTypo ?? DEFAULT_CHARS_PER_TYPO,
  });
  const rating = ratingFor(
    grade,
    { kind: response.kind, latencyMs: response.latencyMs, mode: 'typed' },
    config.thresholds,
  );
  return { grade, rating };
}

/** Input to {@link gradeSpoken}. */
export interface SpokenResponse {
  /** Speech-to-text transcript of what the learner said. */
  transcript: string;
  accepted: readonly string[];
  kind: CardKind;
  latencyMs: number;
  /** Pronunciation score from 0 to 1, if one was computed. */
  pronunciationScore?: number | null;
}

/** Result of {@link gradeSpoken}. */
export interface GradedSpokenResponse extends GradedResponse {
  /**
   * The pronunciation score, passed through for display. It never affects
   * `rating`: correctness is decided by the transcript alone.
   */
  pronunciationScore: number | null;
}

/**
 * Grade a spoken answer by its transcript, with a more lenient typo
 * allowance than typed answers. The pronunciation score is reported
 * separately and never changes the rating.
 *
 * @throws RangeError when `pronunciationScore` is outside 0 to 1
 */
export function gradeSpoken(
  response: SpokenResponse,
  config: GradingConfig = {},
): GradedSpokenResponse {
  const score = response.pronunciationScore ?? null;
  if (score !== null && !(score >= 0 && score <= 1)) {
    throw new RangeError('pronunciationScore must be between 0 and 1');
  }
  const grade = gradeAnswer(response.transcript, response.accepted, {
    charsPerTypo: config.charsPerTypo ?? DEFAULT_SPOKEN_CHARS_PER_TYPO,
  });
  const rating = ratingFor(
    grade,
    { kind: response.kind, latencyMs: response.latencyMs, mode: 'spoken' },
    config.thresholds,
  );
  return { grade, rating, pronunciationScore: score };
}
