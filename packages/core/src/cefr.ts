/** CEFR levels, lowest first. */
export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

/** All CEFR levels, lowest first. */
export const CEFR_LEVELS: readonly CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/** An estimated level: a CEFR level, or `pre-A1` before the first is reached. */
export type CefrEstimateLevel = 'pre-A1' | CefrLevel;

const ESTIMATE_LEVELS: readonly CefrEstimateLevel[] = ['pre-A1', ...CEFR_LEVELS];

/**
 * Cumulative known lemmas at which each level counts as reached.
 *
 * Sources: the project's vocabulary and grammar order report gives
 * cumulative lemma targets per stage: A1 150 to 1,000, A2 1,000 to 2,500,
 * B1 2,500 to 5,000, B2 5,000 to 8,000, and C1 and beyond 8,000 to 10,000+.
 * A level is reached at the end of its stage. The report gives no C2 figure;
 * 15,000 is an extrapolation and should be read as "beyond C1".
 *
 * Vocabulary size is only one signal. Pair it with grammar and speaking, and
 * always show the result as an estimate with a range.
 */
export const CEFR_LEMMA_THRESHOLDS: Readonly<Record<CefrLevel, number>> = {
  A1: 1_000,
  A2: 2_500,
  B1: 5_000,
  B2: 8_000,
  C1: 10_000,
  C2: 15_000,
};

/** Within this share below the next threshold, the range reaches the next level. */
const NEAR_NEXT_LEVEL = 0.9;
/** Speaking scores below this pull the low end of the range down one level. */
const SPEAKING_LAG_SCORE = 0.4;

/** Input to {@link estimateCefr}. */
export interface CefrInput {
  /** Distinct known lemmas (see `knownLemmaCount`). */
  knownLemmas: number;
  /** Grammar points the learner has unlocked. */
  unlockedGrammarIds: readonly number[];
  /**
   * Grammar points each level needs, from the content's grammar graph. A
   * level is reached only when its points and those of every lower level are
   * unlocked. Levels not listed need none. Omit to ignore grammar.
   */
  grammarRequirements?: Partial<Record<CefrLevel, readonly number[]>>;
  /** Recent speaking score from 0 to 1, if any. */
  speakingScore?: number;
  /** Override {@link CEFR_LEMMA_THRESHOLDS}. */
  thresholds?: Readonly<Record<CefrLevel, number>>;
}

/** How much to trust an estimate. */
export type CefrConfidence = 'low' | 'medium' | 'high';

/** Result of {@link estimateCefr}. */
export interface CefrEstimate {
  /** Best single estimate: the lower of the vocabulary and grammar levels. */
  level: CefrEstimateLevel;
  /** Plausible range to show alongside the level. */
  range: { low: CefrEstimateLevel; high: CefrEstimateLevel };
  /** `low` from vocabulary alone; higher when grammar and speaking agree. */
  confidence: CefrConfidence;
  /** The level after the vocabulary level, or null at the top. */
  nextLevel: CefrLevel | null;
  /** Lemma threshold of `nextLevel`, or null at the top. */
  nextLevelLemmas: number | null;
  /** Known lemmas still needed for `nextLevel` (0 at the top). */
  lemmasToNextLevel: number;
}

function rank(level: CefrEstimateLevel): number {
  return ESTIMATE_LEVELS.indexOf(level);
}

function atRank(index: number): CefrEstimateLevel {
  return ESTIMATE_LEVELS[Math.max(0, Math.min(ESTIMATE_LEVELS.length - 1, index))] ?? 'pre-A1';
}

function vocabularyLevel(
  knownLemmas: number,
  thresholds: Readonly<Record<CefrLevel, number>>,
): CefrEstimateLevel {
  let level: CefrEstimateLevel = 'pre-A1';
  for (const candidate of CEFR_LEVELS) {
    if (knownLemmas >= thresholds[candidate]) level = candidate;
  }
  return level;
}

function grammarLevel(
  unlocked: ReadonlySet<number>,
  requirements: Partial<Record<CefrLevel, readonly number[]>>,
): CefrEstimateLevel {
  let level: CefrEstimateLevel = 'pre-A1';
  for (const candidate of CEFR_LEVELS) {
    const needed = requirements[candidate] ?? [];
    if (!needed.every((id) => unlocked.has(id))) break;
    level = candidate;
  }
  return level;
}

function nextLevelOf(level: CefrEstimateLevel): CefrLevel | null {
  switch (level) {
    case 'pre-A1':
      return 'A1';
    case 'A1':
      return 'A2';
    case 'A2':
      return 'B1';
    case 'B1':
      return 'B2';
    case 'B2':
      return 'C1';
    case 'C1':
      return 'C2';
    case 'C2':
      return null;
  }
}

/**
 * Estimate the learner's CEFR level from known lemmas, unlocked grammar and
 * (optionally) speaking. The level is the lower of the vocabulary and
 * grammar levels. The range runs from that level (one lower if speaking
 * lags) up to the vocabulary level, or the next level when within 10% of its
 * threshold.
 *
 * @throws RangeError when `knownLemmas` is negative or `speakingScore` is outside 0 to 1
 */
export function estimateCefr(input: CefrInput): CefrEstimate {
  const thresholds = input.thresholds ?? CEFR_LEMMA_THRESHOLDS;
  if (!(Number.isFinite(input.knownLemmas) && input.knownLemmas >= 0)) {
    throw new RangeError('knownLemmas must be a non-negative number');
  }
  const speaking = input.speakingScore;
  if (speaking !== undefined && !(speaking >= 0 && speaking <= 1)) {
    throw new RangeError('speakingScore must be between 0 and 1');
  }

  const vocab = vocabularyLevel(input.knownLemmas, thresholds);
  const grammar =
    input.grammarRequirements === undefined
      ? vocab
      : grammarLevel(new Set(input.unlockedGrammarIds), input.grammarRequirements);
  const level = rank(grammar) < rank(vocab) ? grammar : vocab;

  const nextLevel = nextLevelOf(vocab);
  const nextLevelLemmas = nextLevel === null ? null : thresholds[nextLevel];
  let high = vocab;
  if (nextLevelLemmas !== null && input.knownLemmas >= nextLevelLemmas * NEAR_NEXT_LEVEL) {
    high = atRank(rank(vocab) + 1);
  }
  let low = level;
  if (speaking !== undefined && speaking < SPEAKING_LAG_SCORE) {
    low = atRank(rank(level) - 1);
  }

  const signals =
    (input.grammarRequirements === undefined ? 0 : 1) + (speaking === undefined ? 0 : 1);
  let confidence: CefrConfidence = 'low';
  if (signals === 2 && low === high) confidence = 'high';
  else if (signals >= 1) confidence = 'medium';

  return {
    level,
    range: { low, high },
    confidence,
    nextLevel,
    nextLevelLemmas,
    lemmasToNextLevel:
      nextLevelLemmas === null ? 0 : Math.max(0, Math.ceil(nextLevelLemmas - input.knownLemmas)),
  };
}

/** Input to {@link projectHoursToNextLevel}. */
export interface HoursProjectionInput {
  knownLemmas: number;
  /** Study hours in the observation window (for example the last 30 days). */
  observedHours: number;
  /** Net known lemmas gained in that window. */
  observedLemmasGained: number;
  /** Minimum observed hours before projecting. Defaults to 1. */
  minObservedHours?: number;
  thresholds?: Readonly<Record<CefrLevel, number>>;
}

/** Result of {@link projectHoursToNextLevel}. */
export interface HoursProjection {
  nextLevel: CefrLevel;
  lemmasNeeded: number;
  /** Study hours to the next level's vocabulary threshold at the observed rate. */
  hours: number;
}

/**
 * Project study hours to the next level's vocabulary threshold from the
 * observed rate of known lemmas gained per hour. Vocabulary only: it does not
 * account for grammar or the slowing rate at higher levels, so present it as
 * a rough guide.
 *
 * @returns null when there is too little data, no progress, or no next level
 */
export function projectHoursToNextLevel(input: HoursProjectionInput): HoursProjection | null {
  const thresholds = input.thresholds ?? CEFR_LEMMA_THRESHOLDS;
  const minHours = input.minObservedHours ?? 1;
  if (!(input.observedHours >= minHours) || !(input.observedLemmasGained > 0)) {
    return null;
  }
  const nextLevel = nextLevelOf(vocabularyLevel(input.knownLemmas, thresholds));
  if (nextLevel === null) return null;
  const lemmasNeeded = Math.max(0, Math.ceil(thresholds[nextLevel] - input.knownLemmas));
  const rate = input.observedLemmasGained / input.observedHours;
  return { nextLevel, lemmasNeeded, hours: lemmasNeeded / rate };
}
