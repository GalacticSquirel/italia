import {
  recordStudy,
  viewStreak,
  type StreakEvent,
  type StreakView,
  type StudyActivity,
} from '@italia/core';

import type { Repositories } from '@/data';

import { STREAK_CONFIG } from './time';

/**
 * Record study against the stored streak with core's streak rules and save
 * the result.
 *
 * @returns the events the study caused
 */
export function recordStreakStudy(repos: Repositories, activity: StudyActivity): StreakEvent[] {
  const update = recordStudy(repos.streak.get(), activity, STREAK_CONFIG);
  repos.streak.save(update.state, activity.at);
  return update.events;
}

/** The stored streak as of `now`, for display. */
export function currentStreak(repos: Repositories, now: Date): StreakView {
  return viewStreak(repos.streak.get(), now, STREAK_CONFIG);
}
