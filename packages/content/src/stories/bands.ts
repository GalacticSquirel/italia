/**
 * Level bands for graded stories. A band is a lemma-rank ceiling: a story in band
 * 300 is written almost entirely (at least 98% of its word tokens, names aside)
 * with the 300 most frequent seed lemmas, and takes the rest from the next band.
 *
 * Each band also has a grammar ceiling, expressed as the highest grammar point
 * `order` (the position in `GRAMMAR_POINTS`, i.e. acquisition order) a story in the
 * band may use, plus length limits that grow with the band.
 */
import { GRAMMAR_POINTS } from '../grammar/points';

/** Lemma-rank ceilings, easiest first. */
export const STORY_BANDS = [150, 300, 500, 750, 1000, 1500, 2000, 3000] as const;
export type StoryBand = (typeof STORY_BANDS)[number];

/** CEFR levels, matching `CEFR_LEVELS` in `apps/mobile/src/db/schema.ts`. */
export const STORY_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type StoryLevel = (typeof STORY_LEVELS)[number];

/** Everything a validator needs to know about one band. */
export interface BandRules {
  readonly band: StoryBand;
  /** CEFR level stories in this band are filed under. */
  readonly level: StoryLevel;
  /** Ceiling of the band below (0 for the first band): words above it are new here. */
  readonly previous: number;
  /** Ceiling of the band above (the same as `band` for the last band). */
  readonly next: number;
  /**
   * Highest grammar point `order` allowed. Points are in acquisition order, so this
   * also forbids every later point (no passato prossimo before band 500, and so on).
   */
  readonly maxGrammarOrder: number;
  /** Story length in word tokens (inclusive). */
  readonly words: readonly [min: number, max: number];
  /** Longest sentence in word tokens. */
  readonly maxSentenceWords: number;
}

const order = (slug: string): number => {
  const i = GRAMMAR_POINTS.findIndex((p) => p.slug === slug);
  if (i < 0) throw new Error(`Unknown grammar slug ${slug}`);
  return i + 1;
};

/**
 * Band -> rules. The grammar ceilings, by the last point allowed:
 *
 * | band | level | last grammar point allowed | what that adds |
 * |---|---|---|---|
 * | 150 | A1 | `piacere` | the whole present-tense A1 core: articles, essere/avere, c'è, negation, questions, regular/irregular/modal present, prepositions, demonstratives, possessives, piacere |
 * | 300 | A1 | `piacere` | (same: more words, no new grammar) |
 * | 500 | A1 | `passato-prossimo-essere` | passato prossimo with avere and essere, irregular participles |
 * | 750 | A2 | `indirect-object-pronouns` | reflexive verbs, object pronouns |
 * | 1000 | A2 | `passato-prossimo-vs-imperfetto` | imperfetto |
 * | 1500 | A2 | `comparatives` | future, stare + gerund, imperative, comparatives |
 * | 2000 | B1 | `infinitive-past` | ci, ne, conditional, imperative with pronouns, double pronouns, relatives, trapassato, future perfect, past conditional, impersonal si, gerund clauses, past infinitive |
 * | 3000 | B1 | `subjunctive-past` | all of B1: connectors, real if-clauses, the passive, present and past subjunctive |
 *
 * Bands above B1 (B2 to C2) use the later points of the syllabus.
 */
export const BAND_RULES: Readonly<Record<StoryBand, BandRules>> = {
  150: rules(150, 'A1', 'piacere', [80, 140], 10),
  300: rules(300, 'A1', 'piacere', [100, 170], 12),
  500: rules(500, 'A1', 'passato-prossimo-essere', [120, 200], 14),
  750: rules(750, 'A2', 'indirect-object-pronouns', [150, 240], 16),
  1000: rules(1000, 'A2', 'passato-prossimo-vs-imperfetto', [170, 270], 18),
  1500: rules(1500, 'A2', 'comparatives', [200, 300], 20),
  2000: rules(2000, 'B1', 'infinitive-past', [230, 330], 24),
  3000: rules(3000, 'B1', 'subjunctive-past', [250, 350], 28),
};

function rules(
  band: StoryBand,
  level: StoryLevel,
  lastGrammarSlug: string,
  words: readonly [number, number],
  maxSentenceWords: number,
): BandRules {
  const i = STORY_BANDS.indexOf(band);
  return {
    band,
    level,
    previous: i > 0 ? (STORY_BANDS[i - 1] ?? 0) : 0,
    next: STORY_BANDS[i + 1] ?? band,
    maxGrammarOrder: order(lastGrammarSlug),
    words,
    maxSentenceWords,
  };
}

/** Rules for a band (throws for a number that is not a band). */
export function bandRules(band: number): BandRules {
  const found = STORY_BANDS.find((b) => b === band);
  if (found === undefined) throw new Error(`Unknown story band ${band}`);
  return BAND_RULES[found];
}
