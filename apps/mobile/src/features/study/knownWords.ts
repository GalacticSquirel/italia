/**
 * Known words, measured the same way everywhere (Progress, the tutor's learner
 * profile and the daily path): a word is known when its in-context recall card
 * is retained (`knownLemmaCount` in core).
 */
import { knownLemmaCount, type LemmaCard } from '@italia/core';

import { toSchedule, type CardRow } from '@/data';

/** The card kind that measures whether a word is known: recall of the word in context. */
export const KNOWN_WORD_KIND = 'cloze_production';

/** A word card as core's known-word measures take it. */
export function lemmaCard(row: CardRow): LemmaCard {
  return { lemmaIds: [row.targetId], schedule: toSchedule(row) };
}

/** Words known at `now`, from all of the learner's cards. */
export function knownWordCount(rows: readonly CardRow[], now: Date): number {
  return knownLemmaCount(rows.filter((r) => r.kind === KNOWN_WORD_KIND).map(lemmaCard), now);
}
