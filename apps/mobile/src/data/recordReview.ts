import type { CardSchedule, Rating } from '@italia/core';

import type { AppDatabase } from '@/db/types';

import { createCardRepo } from './CardRepo';
import type { IdGenerator } from './ids';
import { createReviewLogRepo } from './ReviewLogRepo';
import type { ReviewLogRow } from './rows';

/** One completed review, with the next card state already computed by `@italia/core`. */
export interface RecordReviewInput {
  cardId: string;
  rating: Rating;
  /** What the learner typed or said, if anything. */
  answer: string | null;
  latencyMs: number;
  reviewedAt: Date;
  deviceId: string;
  /** The card's scheduling fields after this review (`scheduler.review(...).card`). */
  next: CardSchedule;
  /** Log id; defaults to a new UUID. */
  logId?: string;
}

/**
 * Persist a review atomically: append its `review_log` row and replace the
 * card's FSRS state with `input.next`, in one transaction. If either write
 * fails (for example the card does not exist) neither is kept.
 *
 * @returns the appended log row
 * @throws CardNotFoundError when the card does not exist
 */
export function recordReview(
  db: AppDatabase,
  input: RecordReviewInput,
  newId: IdGenerator,
): ReviewLogRow {
  return db.transaction((tx) => {
    const cards = createCardRepo(tx);
    cards.upsertState(input.cardId, input.next);
    return createReviewLogRepo(tx, newId).append({
      id: input.logId ?? newId(),
      cardId: input.cardId,
      rating: input.rating,
      answer: input.answer,
      latencyMs: input.latencyMs,
      reviewedAt: input.reviewedAt,
      deviceId: input.deviceId,
    });
  });
}
