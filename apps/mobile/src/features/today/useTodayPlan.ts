import { useMemo } from 'react';

import type { NewItemLimitReason, StoryFit, StreakView } from '@italia/core';

import type { Repositories } from '@/data';
import { useRepositories } from '@/db';
import { useFocusNow } from '@/features/navigation/useFocusNow';
import { loadLibrary } from '@/features/read/library';
import { STORY_ACTIVITY } from '@/features/read/readingSession';
import { estimateReadingMinutes } from '@/features/read/storyModel';
import { planToday } from '@/features/study/planning';
import { currentStreak } from '@/features/study/streakService';
import { startOfLocalDay, startOfNextLocalDay } from '@/features/study/time';

/** The reading block of today's plan: one story episode (plan section 5). */
export interface TodayReading {
  /** `next`: the recommended episode; `closest`: none fits yet, this is the nearest. */
  kind: 'next' | 'closest';
  storyId: string;
  title: string;
  seriesTitle: string;
  episode: number;
  /** Known-word coverage, 0 to 1. */
  coverage: number;
  fit: StoryFit;
  minutes: number;
  /** Stories finished today. */
  readToday: number;
}

/** What the Today screen shows. */
export interface TodaySummary {
  /** Reviews due now that fit today's time budget. */
  reviews: number;
  /** Due reviews left for later because of the time budget. */
  deferredReviews: number;
  newWords: number;
  /** Other new items (sentence and grammar practice). */
  newPractice: number;
  /** Estimated minutes for the planned session, from core's per-item estimates. */
  estimatedMinutes: number;
  /** Items in the planned session. */
  items: number;
  limitedBy: NewItemLimitReason[];
  /** New words left in the curriculum. */
  wordsAvailable: number;
  streak: StreakView;
  /** Active study minutes in the last 7 days. */
  weekMinutes: number;
  minutesBudget: number;
  /** Today's reading block, or null when no stories are installed. */
  reading: TodayReading | null;
}

/** The reading block: the library's up-next episode (or the closest one). */
export function todayReading(repos: Repositories, now: Date): TodayReading | null {
  const library = loadLibrary(repos, now);
  const episode = library.upNext ?? library.closest;
  if (!episode) return null;
  const readToday = repos.studySessions
    .listBetween(startOfLocalDay(now), startOfNextLocalDay(now))
    .reduce((n, s) => n + s.activities.filter((a) => a === STORY_ACTIVITY).length, 0);
  return {
    kind: library.upNext ? 'next' : 'closest',
    storyId: episode.id,
    title: episode.story.title,
    seriesTitle: episode.story.series.titleIt,
    episode: episode.seriesIndex,
    coverage: episode.coverage.ratio,
    fit: episode.fit,
    minutes: estimateReadingMinutes(episode.story.wordCount),
    readToday,
  };
}

/** Summarise today's plan and streak. */
export function summariseToday(repos: Repositories, now: Date): TodaySummary {
  const today = planToday(repos, now);
  const { plan } = today;
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  return {
    reviews: plan.reviewCount,
    deferredReviews: plan.deferredReviewCount,
    newWords: today.newWords,
    newPractice: plan.newCount - countWordItems(today),
    estimatedMinutes: Math.ceil(plan.estimatedSeconds / 60),
    items: plan.items.length,
    limitedBy: today.limitedBy,
    wordsAvailable: today.wordsAvailable,
    streak: currentStreak(repos, now),
    weekMinutes: repos.studySessions.totalActiveMinutes({ from: weekAgo, to: now }),
    minutesBudget: today.settings.minutesBudget,
    reading: todayReading(repos, now),
  };
}

function countWordItems(today: ReturnType<typeof planToday>): number {
  return today.plan.items.filter(
    (i) => i.source === 'new' && (i.kind === 'recognition' || i.kind === 'cloze_production'),
  ).length;
}

/** Today's summary, refreshed whenever the screen is focused. */
export function useTodayPlan(): { summary: TodaySummary; refresh: () => void } {
  const repos = useRepositories();
  const [now, refresh] = useFocusNow();
  const summary = useMemo(() => summariseToday(repos, now), [repos, now]);
  return { summary, refresh };
}
