import {
  coverage,
  DEFAULT_COVERAGE_WINDOW,
  type CoverageOptions,
  type CoverageResult,
  type CoverageToken,
} from './progress';

/**
 * Below this coverage a text turns into decoding practice rather than
 * reading: the fallback recommendation must be at least this well covered.
 */
export const DEFAULT_COVERAGE_FLOOR = 0.9;

/** A story as story selection sees it. */
export interface SelectableStory {
  id: string;
  seriesId: string;
  /** Position within the series, starting at 1. */
  seriesIndex: number;
  /** Word tokens of the whole story, for {@link coverage}. */
  tokens: readonly CoverageToken[];
  /** New words the story is written to teach. */
  targetLemmaIds: readonly number[];
}

/**
 * How well a story's coverage suits extensive reading:
 *
 * - `ideal`: inside the coverage window (95 to 98% by default)
 * - `easy`: above the window; comfortable, but few new words
 * - `stretch`: below the window but at least the floor (90%)
 * - `hard`: below the floor; too many unknown words to read for meaning
 */
export type StoryFit = 'ideal' | 'easy' | 'stretch' | 'hard';

/** One episode in the library. */
export interface EpisodeStatus {
  id: string;
  seriesId: string;
  seriesIndex: number;
  read: boolean;
  /** Locked until the previous episode of its series is read. */
  locked: boolean;
  coverage: CoverageResult;
  fit: StoryFit;
  /** Target words the learner has not met yet, in the story's order. */
  unmetTargetLemmaIds: number[];
}

/** One series in the library. */
export interface SeriesStatus {
  seriesId: string;
  /** Episodes in series order. */
  episodes: EpisodeStatus[];
  readCount: number;
  /** The first unread episode, or null when the series is finished. */
  next: EpisodeStatus | null;
}

/** Input of {@link selectStories}. */
export interface StorySelectionInput {
  stories: readonly SelectableStory[];
  /** Ids of the stories the learner has finished. */
  read: ReadonlySet<string>;
  /** Lemmas the learner knows (see `knownLemmaIds`). */
  known: ReadonlySet<number>;
  /**
   * Lemmas the learner has met (introduced, even if not known yet). Target
   * words outside this set are offered for pre-introduction. Defaults to
   * `known`.
   */
  met?: ReadonlySet<number>;
  /** Target coverage window. Defaults to {@link DEFAULT_COVERAGE_WINDOW}. */
  window?: readonly [number, number];
  /** Lowest coverage for a fallback recommendation. Defaults to {@link DEFAULT_COVERAGE_FLOOR}. */
  floor?: number;
  /** Options passed to {@link coverage}. */
  coverageOptions?: CoverageOptions;
}

/** Result of {@link selectStories}. */
export interface StorySelection {
  /** Series in the order their first story appears in the input. */
  series: SeriesStatus[];
  /**
   * The episode to read next: the best-fitting next unread episode of any
   * series, or null when none reaches the floor.
   */
  upNext: EpisodeStatus | null;
  /**
   * When `upNext` is null, the next unread episode with the highest coverage
   * (to show honestly how far off it is); otherwise null.
   */
  closest: EpisodeStatus | null;
}

/** Absorbs floating-point error at the window edges. */
const EPSILON = 1e-9;

/** Classify a coverage ratio, see {@link StoryFit}. */
export function storyFit(
  ratio: number,
  window: readonly [number, number] = DEFAULT_COVERAGE_WINDOW,
  floor: number = DEFAULT_COVERAGE_FLOOR,
): StoryFit {
  const [min, max] = window;
  if (!(min >= 0 && max <= 1 && min <= max)) {
    throw new RangeError('window must be [min, max] with 0 <= min <= max <= 1');
  }
  if (!(floor >= 0 && floor <= min)) {
    throw new RangeError('floor must be between 0 and the window minimum');
  }
  if (ratio + EPSILON >= min && ratio - EPSILON <= max) return 'ideal';
  if (ratio > max) return 'easy';
  if (ratio + EPSILON >= floor) return 'stretch';
  return 'hard';
}

/** Distance of a ratio from the window (0 inside it). */
function distanceFromWindow(ratio: number, [min, max]: readonly [number, number]): number {
  if (ratio < min) return min - ratio;
  if (ratio > max) return ratio - max;
  return 0;
}

/**
 * Number of new target words in the 3 to 6 range a story should introduce
 * (plan section 5); 0 when inside it, else how far outside.
 */
function targetPenalty(unmet: number): number {
  if (unmet < 3) return 3 - unmet;
  if (unmet > 6) return unmet - 6;
  return 0;
}

/**
 * Lay out the story library and pick what to read next.
 *
 * Episodes unlock in series order: the first episode of every series is open,
 * and each later one opens when the one before it is read. The candidates for
 * "up next" are the first unread episode of each series. Among those, an
 * episode inside the coverage window wins, preferring a series the learner
 * has started (narrow reading recycles vocabulary), then one introducing 3 to
 * 6 new target words, then the higher coverage. Without one in the window,
 * the candidate closest to the window with coverage at least the floor is
 * chosen (again preferring a started series on ties). Remaining ties keep
 * series order, so the result is deterministic.
 */
export function selectStories(input: StorySelectionInput): StorySelection {
  const window = input.window ?? DEFAULT_COVERAGE_WINDOW;
  const floor = input.floor ?? DEFAULT_COVERAGE_FLOOR;
  const met = input.met ?? input.known;

  const bySeries = new Map<string, SelectableStory[]>();
  for (const story of input.stories) {
    const list = bySeries.get(story.seriesId);
    if (list) list.push(story);
    else bySeries.set(story.seriesId, [story]);
  }

  const series: SeriesStatus[] = [];
  for (const [seriesId, stories] of bySeries) {
    const ordered = [...stories].sort((a, b) => a.seriesIndex - b.seriesIndex);
    let previousRead = true;
    const episodes = ordered.map((story): EpisodeStatus => {
      const read = input.read.has(story.id);
      const result = coverage(story.tokens, input.known, input.coverageOptions);
      const episode: EpisodeStatus = {
        id: story.id,
        seriesId,
        seriesIndex: story.seriesIndex,
        read,
        locked: !read && !previousRead,
        coverage: result,
        fit: storyFit(result.ratio, window, floor),
        unmetTargetLemmaIds: story.targetLemmaIds.filter((id) => !met.has(id)),
      };
      previousRead = read;
      return episode;
    });
    series.push({
      seriesId,
      episodes,
      readCount: episodes.filter((e) => e.read).length,
      next: episodes.find((e) => !e.read && !e.locked) ?? null,
    });
  }

  const candidates = series.flatMap((s, order) =>
    s.next ? [{ episode: s.next, started: s.readCount > 0, order }] : [],
  );
  type Candidate = (typeof candidates)[number];
  const byStartedThenOrder = (a: Candidate, b: Candidate) =>
    Number(b.started) - Number(a.started) || a.order - b.order;

  const ideal = candidates
    .filter((c) => c.episode.fit === 'ideal')
    .sort(
      (a, b) =>
        Number(b.started) - Number(a.started) ||
        targetPenalty(a.episode.unmetTargetLemmaIds.length) -
          targetPenalty(b.episode.unmetTargetLemmaIds.length) ||
        b.episode.coverage.ratio - a.episode.coverage.ratio ||
        a.order - b.order,
    );
  const fallback = candidates
    .filter((c) => c.episode.coverage.ratio + EPSILON >= floor)
    .sort(
      (a, b) =>
        distanceFromWindow(a.episode.coverage.ratio, window) -
          distanceFromWindow(b.episode.coverage.ratio, window) || byStartedThenOrder(a, b),
    );
  const upNext = (ideal[0] ?? fallback[0])?.episode ?? null;
  const closest =
    upNext === null
      ? ([...candidates].sort(
          (a, b) => b.episode.coverage.ratio - a.episode.coverage.ratio || byStartedThenOrder(a, b),
        )[0]?.episode ?? null)
      : null;

  return { series, upNext, closest };
}
