/**
 * The learner profile for the tutor prompt, from the database: the CEFR
 * estimate and known-word count (as on the Progress screen), unlocked grammar
 * and recurring errors from `error_record`.
 */
import { estimateCefr, learnerProfileFor, type LearnerProfile } from '@italia/core';

import { type Repositories } from '@/data';
import { getContentIndex } from '@/features/study/content';
import { unlockedGrammar } from '@/features/study/curriculum';
import { knownWordCount } from '@/features/study/knownWords';

/** Build the learner profile the tutor's prompt is rendered from. */
export function loadLearnerProfile(repos: Repositories, now: Date): LearnerProfile {
  const content = getContentIndex(repos);
  const cards = repos.cards.listAll();
  const knownLemmas = knownWordCount(cards, now);
  const unlocked = unlockedGrammar(cards, content);
  const cefr = estimateCefr({ knownLemmas, unlockedGrammarIds: [...unlocked] });
  const errorCounts = repos.errors.countByCategory().map((c) => ({
    ...c,
    lastExample: repos.errors.listByCategory(c.category, 1)[0]?.example ?? null,
  }));
  return learnerProfileFor({
    cefr: cefr.level,
    knownLemmas,
    unlockedGrammarIds: unlocked,
    errorCounts,
  });
}
