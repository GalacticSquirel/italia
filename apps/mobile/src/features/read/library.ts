/**
 * The story library: every bundled story laid out by series with locks and
 * coverage, and the episode to read next, chosen by `selectStories` in core
 * from the learner's known words.
 */
import {
  knownLemmaIds,
  selectStories,
  type EpisodeStatus,
  type LemmaCard,
  type StoryFit,
} from '@italia/core';

import { META_KEYS, toSchedule, type CardRow, type Repositories, type StoredSeries } from '@/data';

import { coverageTokens, toReaderStory, type ReaderStory } from './storyModel';

/** The card kind that measures whether a word is known (as on the Progress screen). */
const KNOWN_WORD_KIND = 'cloze_production';
/** Card kinds that practise a single word. */
const WORD_KINDS: readonly CardRow['kind'][] = ['recognition', 'cloze_production'];

/** What the learner knows and has met, by lemma id. */
export interface LearnerWords {
  /** Lemmas known now (core `isKnown` on their cloze card). */
  known: Set<number>;
  /** Lemmas met: a word card answered at least once. */
  met: Set<number>;
}

/** The learner's known and met lemmas at `now`. */
export function learnerWords(cards: readonly CardRow[], now: Date): LearnerWords {
  const wordCards: LemmaCard[] = cards
    .filter((c) => c.kind === KNOWN_WORD_KIND)
    .map((c) => ({ lemmaIds: [c.targetId], schedule: toSchedule(c) }));
  const met = new Set<number>();
  for (const c of cards) {
    if (WORD_KINDS.includes(c.kind) && c.state !== 'new') met.add(c.targetId);
  }
  return { known: knownLemmaIds(wordCards, now), met };
}

/** An episode with its story. */
export interface LibraryEpisode extends EpisodeStatus {
  story: ReaderStory;
}

/** A series with its episodes. */
export interface LibrarySeries {
  seriesId: string;
  series: StoredSeries;
  level: ReaderStory['level'];
  band: number;
  episodes: LibraryEpisode[];
  readCount: number;
  next: LibraryEpisode | null;
}

/** The library and the recommendation. */
export interface Library {
  /** Series, easiest band first. */
  series: LibrarySeries[];
  /** The episode to read next, or null when none is at least 90% known. */
  upNext: LibraryEpisode | null;
  /** When `upNext` is null: the best-covered next episode, to show how far off it is. */
  closest: LibraryEpisode | null;
  /** Known lemmas used for coverage. */
  knownWords: number;
  /** Lemmas the learner has met (for pre-introducing target words). */
  met: ReadonlySet<number>;
}

const storyCache = new WeakMap<object, { identity: string | null; stories: ReaderStory[] }>();

/**
 * The bundled stories as reader models, easiest band first, then series and
 * episode. Stories change only on an import, so they are parsed once per
 * repositories instance and imported version.
 */
export function bundledStories(repos: Repositories): ReaderStory[] {
  const identity = repos.meta.get(META_KEYS.storiesVersion);
  const cached = storyCache.get(repos);
  if (cached?.identity === identity) return cached.stories;
  const stories = repos.stories
    .listBundled()
    .flatMap((row) => {
      const story = toReaderStory(row);
      return story ? [story] : [];
    })
    .sort(
      (a, b) =>
        a.band - b.band || a.seriesId.localeCompare(b.seriesId) || a.seriesIndex - b.seriesIndex,
    );
  storyCache.set(repos, { identity, stories });
  return stories;
}

/** Lay out the library for the learner at `now`. */
export function loadLibrary(repos: Repositories, now: Date): Library {
  const stories = bundledStories(repos);
  const words = learnerWords(repos.cards.listAll(), now);
  const selection = selectStories({
    stories: stories.map((s) => ({
      id: s.id,
      seriesId: s.seriesId,
      seriesIndex: s.seriesIndex,
      tokens: coverageTokens(s),
      targetLemmaIds: s.targetLemmaIds,
    })),
    read: repos.reading.readStoryIds(),
    known: words.known,
    met: words.met,
  });
  const byId = new Map(stories.map((s) => [s.id, s]));
  const withStory = (e: EpisodeStatus | null): LibraryEpisode | null => {
    const story = e ? byId.get(e.id) : undefined;
    return e && story ? { ...e, story } : null;
  };
  const series = selection.series.flatMap((s): LibrarySeries[] => {
    const episodes = s.episodes.flatMap((e) => {
      const ep = withStory(e);
      return ep ? [ep] : [];
    });
    const first = episodes[0]?.story;
    if (!first) return [];
    return [
      {
        seriesId: s.seriesId,
        series: first.series,
        level: first.level,
        band: first.band,
        episodes,
        readCount: s.readCount,
        next: withStory(s.next),
      },
    ];
  });
  return {
    series,
    upNext: withStory(selection.upNext),
    closest: withStory(selection.closest),
    knownWords: words.known.size,
    met: words.met,
  };
}

/** Short label for how well a story fits, for badges and screen readers. */
export const FIT_LABELS: Record<StoryFit, string> = {
  ideal: 'Just right',
  easy: 'Easy read',
  stretch: 'A stretch',
  hard: 'Too hard for now',
};

/** Coverage as a whole percentage, rounded down so 94.6% never shows as 95%. */
export function coveragePercent(ratio: number): string {
  return `${String(Math.floor(ratio * 100 + 1e-9))}%`;
}
