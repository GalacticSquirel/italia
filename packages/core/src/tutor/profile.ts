/**
 * The learner profile the tutor's prompt is rendered from, built from what
 * the app knows: the CEFR estimate, known-lemma count, unlocked grammar and
 * the error records of earlier conversations and reviews.
 */
import type { CefrEstimateLevel } from '../cefr';
import { ERROR_TAG_BY_ID, levelAtMost } from './render';
import { GRAMMAR_POINTS, LEVEL_BANDS } from './spec.generated';
import { TUTOR_LEVELS } from './types';
import type { ErrorHistoryItem, LearnerProfile, TutorLevel, TutorScenario } from './types';

/** Lowest lemma ceiling the prompt uses: a scene needs the commonest words even at the start. */
export const MIN_LEMMA_CEILING = 300;

/** The tutor level for a CEFR estimate: below A1 talks at A1, otherwise at the estimate. */
export function tutorLevelFor(level: CefrEstimateLevel): TutorLevel {
  switch (level) {
    case 'pre-A1':
    case 'A1':
      return 'A1';
    case 'A2':
    case 'B1':
    case 'B2':
    case 'C1':
    case 'C2':
      return level;
  }
}

/**
 * The known-lemma ceiling for the prompt: the learner's known-word count,
 * at least {@link MIN_LEMMA_CEILING} (a scene needs common function words even
 * for a beginner) and at most the level band's default. Returns null when it
 * equals the band default, which renders the same prompt the model saw most.
 */
export function lemmaCeilingFor(level: TutorLevel, knownLemmas: number): number | null {
  const band = LEVEL_BANDS[level].lemmaCeiling;
  // A count that is not a number (corrupt progress data) counts as a beginner's.
  const rounded = Number.isFinite(knownLemmas) ? Math.round(knownLemmas / 50) * 50 : 0;
  const ceiling = Math.min(band, Math.max(MIN_LEMMA_CEILING, rounded));
  return ceiling === band ? null : ceiling;
}

/**
 * Unlocked grammar as spec slugs, from content grammar point ids. Empty
 * (meaning "everything up to the level") when nothing is unlocked yet or the
 * learner has unlocked nothing at their level, so the prompt never lists an
 * empty set of structures.
 */
export function knownGrammarFor(level: TutorLevel, unlockedContentIds: Iterable<number>): string[] {
  const ids = new Set(unlockedContentIds);
  return GRAMMAR_POINTS.filter(
    (p) => p.id !== null && ids.has(p.id) && levelAtMost(p.cefr, level),
  ).map((p) => p.slug);
}

/** One error category with its count and latest example, as stored by the app. */
export interface ErrorCount {
  category: string;
  count: number;
  lastExample?: string | null;
}

/**
 * The learner's recurring errors for the prompt: taxonomy tags only, at least
 * twice, most frequent first, at most 5.
 */
export function errorHistoryFor(counts: readonly ErrorCount[]): ErrorHistoryItem[] {
  return counts
    .filter((c) => ERROR_TAG_BY_ID.has(c.category) && c.count >= 2)
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category))
    .slice(0, 5)
    .map((c) => ({ tag: c.category, count: c.count, lastExample: c.lastExample ?? null }));
}

/** Inputs to {@link learnerProfileFor}. */
export interface LearnerProfileInput {
  cefr: CefrEstimateLevel;
  knownLemmas: number;
  unlockedGrammarIds: Iterable<number>;
  errorCounts: readonly ErrorCount[];
}

/** Build the learner profile for the tutor prompt. */
export function learnerProfileFor(input: LearnerProfileInput): LearnerProfile {
  const level = tutorLevelFor(input.cefr);
  return {
    level,
    lemmaCeiling: lemmaCeilingFor(level, input.knownLemmas),
    knownGrammar: knownGrammarFor(level, input.unlockedGrammarIds),
    errorHistory: errorHistoryFor(input.errorCounts),
  };
}

/** Scenarios offered at a level, easiest first, then by title. */
export function scenariosForLevel(
  scenarios: readonly TutorScenario[],
  level: TutorLevel,
): TutorScenario[] {
  const lowest = (s: TutorScenario) => Math.min(...s.levels.map((l) => TUTOR_LEVELS.indexOf(l)));
  return scenarios
    .filter((s) => s.levels.includes(level))
    .sort((a, b) => lowest(a) - lowest(b) || a.titleEn.localeCompare(b.titleEn));
}
