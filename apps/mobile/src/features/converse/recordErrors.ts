/**
 * Conversation errors into the learner's data: every correction the tutor
 * makes (after the guard rails in `postValidate`) is stored in `error_record`
 * with its taxonomy tag, and every recast also becomes a review card: a
 * `sentence_production` card that shows what the learner wrote and asks for
 * the corrected sentence.
 */
import {
  correctedSentence,
  ERROR_TAG_BY_ID,
  GRAMMAR_POINT_BY_SLUG,
  normaliseItalian,
  type Scheduler,
  type TutorOutput,
} from '@italia/core';

import type { CardRow, ErrorRecordRow, Repositories } from '@/data';
import { invalidateContentIndex } from '@/features/study/content';

/** What one tutor turn added. */
export interface RecordedTurn {
  errors: ErrorRecordRow[];
  /** The review card made from a recast, if any. */
  card: CardRow | null;
}

/** Content grammar point ids that errors with these tags are evidence about. */
export function grammarIdsForTags(tags: readonly string[]): number[] {
  const ids = new Set<number>();
  for (const tag of tags) {
    for (const slug of ERROR_TAG_BY_ID.get(tag)?.grammarPoints ?? []) {
      const id = GRAMMAR_POINT_BY_SLUG.get(slug)?.id;
      if (id !== null && id !== undefined) ids.add(id);
    }
  }
  return [...ids].sort((a, b) => a - b);
}

/**
 * Record the corrections of one checked tutor turn.
 *
 * - a prompt: one error record per tag (no card: the learner gets to fix it)
 * - a recast: the corrected sentence, a `sentence_production` card for it and
 *   one error record per tag pointing at the card
 */
export function recordTutorTurn(
  repos: Repositories,
  input: { learnerMessage: string; output: TutorOutput; scheduler: Scheduler; now: Date },
): RecordedTurn {
  const { prompt, recast } = input.output.annotations;
  const errors: ErrorRecordRow[] = [];
  if (recast !== null) {
    const sentence = correctedSentence(input.learnerMessage, recast);
    let card: CardRow | null = null;
    if (normaliseItalian(sentence) !== normaliseItalian(input.learnerMessage)) {
      const row = repos.learnerSentences.add({
        it: sentence,
        original: input.learnerMessage,
        errorTags: recast.errorTags,
        grammarIds: grammarIdsForTags(recast.errorTags),
        source: 'conversation',
        createdAt: input.now,
      });
      card = repos.cards.create({
        kind: 'sentence_production',
        targetId: row.id,
        promptMode: 'typed',
        schedule: input.scheduler.newCard(input.now),
        createdAt: input.now,
      });
      invalidateContentIndex(repos);
    }
    for (const tag of recast.errorTags) {
      errors.push(
        repos.errors.add({
          category: tag,
          example: recast.learnerText,
          source: 'conversation',
          cardId: card?.id ?? null,
          createdAt: input.now,
        }),
      );
    }
    return { errors, card };
  }
  if (prompt !== null) {
    for (const tag of prompt.errorTags) {
      errors.push(
        repos.errors.add({
          category: tag,
          example: prompt.learnerText,
          source: 'conversation',
          createdAt: input.now,
        }),
      );
    }
  }
  return { errors, card: null };
}
