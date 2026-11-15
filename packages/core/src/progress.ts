import { retrievability } from './scheduler';
import type { CardSchedule } from './types';

/** Thresholds for {@link isKnown}. */
export interface KnownOptions {
  /** Minimum probability of recall now. Defaults to 0.9. */
  minRetrievability?: number;
  /** Minimum memory stability in days. Defaults to 7. */
  minStabilityDays?: number;
}

/** Default thresholds for {@link isKnown}. */
export const DEFAULT_KNOWN_OPTIONS: Readonly<Required<KnownOptions>> = {
  minRetrievability: 0.9,
  minStabilityDays: 7,
};

/** Absorbs floating-point error at the exact threshold. */
const EPSILON = 1e-9;

/**
 * Whether a card counts as known at `now`: its retrievability is at least 0.9
 * and its stability at least 7 days (both configurable). This is a measure of
 * durable memory, not of having seen the card.
 *
 * @throws RangeError when a threshold is out of range
 */
export function isKnown(card: CardSchedule, now: Date, options: KnownOptions = {}): boolean {
  const minRetrievability = options.minRetrievability ?? DEFAULT_KNOWN_OPTIONS.minRetrievability;
  const minStabilityDays = options.minStabilityDays ?? DEFAULT_KNOWN_OPTIONS.minStabilityDays;
  if (!(minRetrievability >= 0 && minRetrievability <= 1)) {
    throw new RangeError('minRetrievability must be between 0 and 1');
  }
  if (!(minStabilityDays >= 0)) {
    throw new RangeError('minStabilityDays must be non-negative');
  }
  if (card.state === 'new') return false;
  return (
    card.stability + EPSILON >= minStabilityDays &&
    retrievability(card, now) + EPSILON >= minRetrievability
  );
}

/** A card with the lemmas it practises. */
export interface LemmaCard {
  lemmaIds: readonly number[];
  schedule: CardSchedule;
}

/**
 * Ids of the lemmas the learner knows at `now`: a lemma is known when any of
 * its cards {@link isKnown}.
 */
export function knownLemmaIds(
  cards: readonly LemmaCard[],
  now: Date,
  options: KnownOptions = {},
): Set<number> {
  const known = new Set<number>();
  for (const card of cards) {
    if (isKnown(card.schedule, now, options)) {
      for (const id of card.lemmaIds) known.add(id);
    }
  }
  return known;
}

/** Number of distinct known lemmas; see {@link knownLemmaIds}. */
export function knownLemmaCount(
  cards: readonly LemmaCard[],
  now: Date,
  options: KnownOptions = {},
): number {
  return knownLemmaIds(cards, now, options).size;
}

/** One token of a text, as the content pipeline tags it. */
export interface CoverageToken {
  /** The token's lemma, or null for punctuation, numbers and other non-words. */
  lemmaId: number | null;
  /**
   * Further lemmas packed into the same word (the article of "nel", the
   * pronouns of "dimmi"). The token counts as known only when its lemma and
   * all of these are known.
   */
  partIds?: readonly number[];
  /** True for names of people, places and the like. */
  properNoun?: boolean;
}

/** Options for {@link coverage}. */
export interface CoverageOptions {
  /** Leave proper nouns out of the count. Defaults to true. */
  excludeProperNouns?: boolean;
  /** Lemmas flagged as transparent cognates, left out of the count. */
  cognates?: ReadonlySet<number>;
}

/** Result of {@link coverage}. */
export interface CoverageResult {
  /** `knownTokens / countedTokens`; 1 when nothing is counted. */
  ratio: number;
  knownTokens: number;
  countedTokens: number;
  /** Distinct unknown lemmas, in order of first appearance. */
  unknownLemmaIds: number[];
}

/**
 * Known-word coverage of a text: the share of counted tokens (word tokens,
 * excluding proper nouns and flagged cognates) whose lemmas are all known.
 */
export function coverage(
  tokens: readonly CoverageToken[],
  known: ReadonlySet<number>,
  options: CoverageOptions = {},
): CoverageResult {
  const excludeProperNouns = options.excludeProperNouns ?? true;
  const cognates = options.cognates;
  let counted = 0;
  let knownTokens = 0;
  const unknown = new Set<number>();
  for (const token of tokens) {
    const id = token.lemmaId;
    if (id === null) continue;
    if (excludeProperNouns && token.properNoun === true) continue;
    if (cognates?.has(id) === true) continue;
    counted++;
    let tokenKnown = known.has(id);
    if (!tokenKnown) unknown.add(id);
    for (const part of token.partIds ?? []) {
      if (known.has(part)) continue;
      tokenKnown = false;
      unknown.add(part);
    }
    if (tokenKnown) knownTokens++;
  }
  return {
    ratio: counted === 0 ? 1 : knownTokens / counted,
    knownTokens,
    countedTokens: counted,
    unknownLemmaIds: [...unknown],
  };
}

/**
 * Target coverage for reading and listening: 95 to 98% of words known, the
 * band in which learners understand a text and pick up new words from it.
 */
export const DEFAULT_COVERAGE_WINDOW: readonly [number, number] = [0.95, 0.98];

/**
 * Whether a coverage ratio falls inside the window (inclusive).
 *
 * @throws RangeError when the window is inverted or outside 0 to 1
 */
export function storyFits(
  ratio: number,
  window: readonly [number, number] = DEFAULT_COVERAGE_WINDOW,
): boolean {
  const [min, max] = window;
  if (!(min >= 0 && max <= 1 && min <= max)) {
    throw new RangeError('window must be [min, max] with 0 <= min <= max <= 1');
  }
  return ratio + EPSILON >= min && ratio - EPSILON <= max;
}
