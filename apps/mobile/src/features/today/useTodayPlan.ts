import { useMemo } from 'react';

import type { NewItemLimitReason, StreakView } from '@italia/core';

import type { Repositories } from '@/data';
import { useRepositories } from '@/db';
import { useFocusNow } from '@/features/navigation/useFocusNow';
import { planToday } from '@/features/study/planning';
import { currentStreak } from '@/features/study/streakService';

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
