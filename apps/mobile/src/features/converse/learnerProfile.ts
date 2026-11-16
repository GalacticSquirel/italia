/**
 * The learner profile for the tutor prompt, from the database: the CEFR
 * estimate and known-word count (as on the Progress screen), unlocked grammar
 * and recurring errors from `error_record`.
 */
import {
  estimateCefr,
  knownLemmaCount,
  learnerProfileFor,
  type LearnerProfile,
} from '@italia/core';

import { toSchedule, type Repositories } from '@/data';
import { getContentIndex } from '@/features/study/content';
import { unlockedGrammar } from '@/features/study/curriculum';

/** The card kind that measures whether a word is known (as on the Progress screen). */
const KNOWN_WORD_KIND = 'cloze_production';

/** Build the learner profile the tutor's prompt is rendered from. */
export function loadLearnerProfile(repos: Repositories, now: Date): LearnerProfile {
  const content = getContentIndex(repos);
  const cards = repos.cards.listAll();
  const knownLemmas = knownLemmaCount(
    cards
      .filter((c) => c.kind === KNOWN_WORD_KIND)
      .map((c) => ({ lemmaIds: [c.targetId], schedule: toSchedule(c) })),
    now,
  );
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
