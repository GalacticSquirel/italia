import { useMemo } from 'react';

import { useRepositories } from '@/db';
import { useFocusNow } from '@/features/navigation/useFocusNow';

import { loadLibrary, type Library } from './library';

/** The story library, refreshed whenever the screen is focused. */
export function useLibrary(): Library {
  const repos = useRepositories();
  const [now] = useFocusNow();
  return useMemo(() => loadLibrary(repos, now), [repos, now]);
}
