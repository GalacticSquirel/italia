import { useMemo } from 'react';

import { useRepositories } from '@/db';
import { useFocusNow } from '@/features/navigation/useFocusNow';

import { loadProgress, type ProgressData } from './progressData';

/** Progress data, refreshed whenever the screen is focused. */
export function useProgress(): ProgressData {
  const repos = useRepositories();
  const [now] = useFocusNow();
  return useMemo(() => loadProgress(repos, now), [repos, now]);
}
