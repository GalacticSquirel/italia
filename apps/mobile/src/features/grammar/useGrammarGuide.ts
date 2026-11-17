import { useMemo } from 'react';

import type { Repositories } from '@/data';
import { useRepositories } from '@/db';
import { useFocusNow } from '@/features/navigation/useFocusNow';
import { getContentIndex } from '@/features/study/content';

import { buildGrammarGuide, type GuideLevel, type GuidePoint } from './grammarGuide';

/**
 * Load the guide from the database. `_at` is when it is loaded: passing a new
 * time (on screen focus) reloads it, so it reflects answers given since.
 */
function loadGrammarGuide(repos: Repositories, _at: Date): GuideLevel[] {
  return buildGrammarGuide(getContentIndex(repos), repos.cards.listAll());
}

/** The grammar guide for the learner's cards, refreshed when the screen gains focus. */
export function useGrammarGuide(): GuideLevel[] {
  const repos = useRepositories();
  const [now] = useFocusNow();
  return useMemo(() => loadGrammarGuide(repos, now), [repos, now]);
}

/** One point of the guide with its drills, or null when it is not in the content. */
export function useGrammarPoint(pointId: number) {
  const repos = useRepositories();
  const levels = useGrammarGuide();
  return useMemo(() => {
    const entry: GuidePoint | undefined = levels
      .flatMap((l) => l.points)
      .find((p) => p.point.id === pointId);
    if (!entry) return null;
    return { ...entry, drills: getContentIndex(repos).drillsByPoint.get(pointId) ?? [] };
  }, [levels, pointId, repos]);
}
