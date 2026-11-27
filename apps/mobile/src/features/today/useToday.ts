import { useCallback, useMemo, useState } from 'react';

import type { DailyStepId } from '@italia/core';

import { useRepositories } from '@/db';
import { useFocusNow } from '@/features/navigation/useFocusNow';
import { useTutorModel } from '@/tutor';

import { loadToday, skipStep, type TodayData } from './dailyPath';

/** The state of loading today's path. */
export type TodayState =
  { status: 'ready'; data: TodayData } | { status: 'error'; message: string };

function load(...args: Parameters<typeof loadToday>): TodayState {
  try {
    return { status: 'ready', data: loadToday(...args) };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Today's path, reloaded whenever the screen comes into view (for example
 * after finishing a step), with a way to skip a step.
 */
export function useToday(): {
  state: TodayState;
  refresh: () => void;
  skip: (id: DailyStepId) => void;
} {
  const repos = useRepositories();
  const tutor = useTutorModel();
  const [now, refresh] = useFocusNow();
  const state = useMemo(() => load(repos, now, tutor), [repos, now, tutor]);
  const skip = useCallback(
    (id: DailyStepId) => {
      skipStep(repos, id, new Date());
      refresh();
    },
    [repos, refresh],
  );
  return { state, refresh, skip };
}

/**
 * Today's path as it stands when the calling component mounts: for the
 * hand-off at the end of a step, which mounts once the step is recorded.
 *
 * @param at - when the step finished; defaults to now
 */
export function useTodayOnMount(at?: Date): TodayState {
  const repos = useRepositories();
  const tutor = useTutorModel();
  const [state] = useState(() => load(repos, at ?? new Date(), tutor));
  return state;
}
