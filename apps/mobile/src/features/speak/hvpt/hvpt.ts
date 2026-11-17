/**
 * High-variability phonetic training (HVPT): two-alternative forced choice on
 * the curated minimal pairs of `@italia/speech`, many talkers, immediate
 * feedback, and adaptive difficulty. Pure: the screen plays the audio.
 *
 * - **Difficulty** is a staircase over three levels. Level 1 trains pure
 *   consonant length (pairs with no other difference) at a slower rate;
 *   level 2 adds the remaining length pairs and stress; level 3 adds open
 *   and close e/o and a faster rate. Three correct answers in a row move up;
 *   two errors in the last four trials move down (an accuracy of roughly
 *   80%, where perceptual learning is effective).
 * - **Adaptivity**: contrasts and pairs the learner misses come up more often
 *   (weight = smoothed error rate + a floor, so nothing disappears).
 * - **Talkers** rotate every trial; the same pair never comes twice in a row.
 */
import type { Rng } from '@italia/core';
import {
  minimalPairsFor,
  type MinimalPairContrast,
  type MinimalPairItem,
  type MinimalPairSet,
} from '@italia/speech';

/** Difficulty level. */
export type HvptLevel = 1 | 2 | 3;

/** Accuracy counts. */
export interface Tally {
  correct: number;
  total: number;
}

/** Learner state, persisted between sessions. */
export interface HvptStats {
  level: HvptLevel;
  byContrast: Partial<Record<MinimalPairContrast, Tally>>;
  /** By {@link setKey}. */
  bySet: Record<string, Tally>;
  /** Results of the latest trials, newest last (at most 4). */
  recent: boolean[];
  /** Correct answers in a row. */
  streak: number;
}

/** One trial. */
export interface HvptTrial {
  set: MinimalPairSet;
  key: string;
  /** The word played. */
  target: MinimalPairItem;
  /** The two choices, in display order. */
  options: readonly [MinimalPairItem, MinimalPairItem];
  /** Index of the talker (voice or speaker) to use. */
  talker: number;
  /** Playback rate. */
  rate: number;
  level: HvptLevel;
}

/** A fresh learner. */
export const INITIAL_HVPT_STATS: HvptStats = {
  level: 1,
  byContrast: {},
  bySet: {},
  recent: [],
  streak: 0,
};

/** Playback rate per level. */
export const LEVEL_RATES: Readonly<Record<HvptLevel, number>> = { 1: 0.85, 2: 1, 3: 1.15 };

/** Stable key of a minimal set. */
export function setKey(set: MinimalPairSet): string {
  return `${set.contrast}:${set.items.map((i) => i.accented).join('/')}`;
}

/**
 * The sets in play at a level. `contrasts` limits them to what the audio
 * source can render (device voices cannot reliably make open/close vowels).
 */
export function setsForLevel(
  level: HvptLevel,
  contrasts: readonly MinimalPairContrast[] = ['geminate', 'stress', 'midVowel'],
): MinimalPairSet[] {
  const allowed = new Set(contrasts);
  const geminate = minimalPairsFor('geminate');
  const sets: MinimalPairSet[] =
    level === 1 ? geminate.filter((s) => s.alsoDiffers.length === 0) : [...geminate];
  if (level >= 2) sets.push(...minimalPairsFor('stress'));
  if (level >= 3) sets.push(...minimalPairsFor('midVowel'));
  const out = sets.filter((s) => allowed.has(s.contrast));
  return out.length > 0 ? out : geminate.filter((s) => s.alsoDiffers.length === 0);
}

const errorWeight = (tally: Tally | undefined) =>
  // Laplace-smoothed error rate plus a floor.
  ((tally?.total ?? 0) - (tally?.correct ?? 0) + 1) / ((tally?.total ?? 0) + 2) + 0.15;

function pickWeighted<T>(items: readonly T[], weight: (item: T) => number, rng: Rng): T {
  const weights = items.map(weight);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i] ?? 0;
    if (r <= 0) return items[i] as T;
  }
  return items[items.length - 1] as T;
}

/** Options for {@link nextTrial}. */
export interface NextTrialOptions {
  rng: Rng;
  /** Talkers available (at least 1). */
  talkers: number;
  /** The previous trial, to avoid repeats. */
  previous?: HvptTrial | null;
  contrasts?: readonly MinimalPairContrast[];
}

/** Choose the next trial. */
export function nextTrial(stats: HvptStats, options: NextTrialOptions): HvptTrial {
  const { rng, previous } = options;
  const sets = setsForLevel(stats.level, options.contrasts);
  const contrasts = [...new Set(sets.map((s) => s.contrast))];
  const contrast = pickWeighted(contrasts, (c) => errorWeight(stats.byContrast[c]), rng);
  const pool = sets.filter((s) => s.contrast === contrast && setKey(s) !== previous?.key);
  const set = pickWeighted(
    pool.length > 0 ? pool : sets,
    (s) => errorWeight(stats.bySet[setKey(s)]),
    rng,
  );
  const target = set.items[Math.floor(rng() * set.items.length)] ?? set.items[0];
  if (!target) throw new Error('empty minimal set');
  const others = set.items.filter((i) => i !== target);
  const foil = others[Math.floor(rng() * others.length)] ?? target;
  const options2: [MinimalPairItem, MinimalPairItem] =
    rng() < 0.5 ? [target, foil] : [foil, target];
  const talkers = Math.max(1, Math.floor(options.talkers));
  let talker = Math.floor(rng() * talkers);
  if (talkers > 1 && talker === previous?.talker) talker = (talker + 1) % talkers;
  return {
    set,
    key: setKey(set),
    target,
    options: options2,
    talker,
    rate: LEVEL_RATES[stats.level],
    level: stats.level,
  };
}

const bump = (tally: Tally | undefined, correct: boolean): Tally => ({
  correct: (tally?.correct ?? 0) + (correct ? 1 : 0),
  total: (tally?.total ?? 0) + 1,
});

/** Record an answer; returns whether it was right and the updated stats. */
export function answerTrial(
  stats: HvptStats,
  trial: HvptTrial,
  chosen: MinimalPairItem,
): { correct: boolean; stats: HvptStats; levelChange: -1 | 0 | 1 } {
  const correct = chosen.accented === trial.target.accented;
  const recent = [...stats.recent, correct].slice(-4);
  const streak = correct ? stats.streak + 1 : 0;
  let level = stats.level;
  let levelChange: -1 | 0 | 1 = 0;
  if (streak >= 3 && level < 3) {
    level = (level + 1) as HvptLevel;
    levelChange = 1;
  } else if (!correct && recent.filter((r) => !r).length >= 2 && level > 1) {
    level = (level - 1) as HvptLevel;
    levelChange = -1;
  }
  return {
    correct,
    levelChange,
    stats: {
      level,
      byContrast: {
        ...stats.byContrast,
        [trial.set.contrast]: bump(stats.byContrast[trial.set.contrast], correct),
      },
      bySet: { ...stats.bySet, [trial.key]: bump(stats.bySet[trial.key], correct) },
      recent: levelChange === 0 ? recent : [],
      streak: levelChange === 0 ? streak : 0,
    },
  };
}

/** Parse stored stats, falling back to a fresh learner. */
const isRecord = (v: unknown): v is Record<string, Tally> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseHvptStats(json: string | null): HvptStats {
  if (json === null) return INITIAL_HVPT_STATS;
  try {
    const value = JSON.parse(json) as Partial<HvptStats> | null;
    if (typeof value !== 'object' || value === null) return INITIAL_HVPT_STATS;
    const level = value.level === 2 || value.level === 3 ? value.level : 1;
    return {
      level,
      byContrast: isRecord(value.byContrast) ? value.byContrast : {},
      bySet: isRecord(value.bySet) ? value.bySet : {},
      recent: Array.isArray(value.recent)
        ? value.recent.filter((r): r is boolean => typeof r === 'boolean').slice(-4)
        : [],
      streak: Number.isSafeInteger(value.streak) ? Math.max(0, value.streak ?? 0) : 0,
    };
  } catch {
    return INITIAL_HVPT_STATS;
  }
}
