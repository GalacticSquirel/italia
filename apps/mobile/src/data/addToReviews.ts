import type { CardRepo, NewCardInput } from './CardRepo';
import { cardIdFor } from './ids';

/**
 * Outcome of {@link addToReviews}: the card was `added`, `restored` (it was
 * suspended), or was `already` in the learner's reviews.
 */
export type AddToReviewsResult = 'added' | 'restored' | 'already';

/**
 * Put a card in the learner's reviews: create it when missing (with the
 * deterministic id from `cardIdFor`, so every device names it alike), or
 * unsuspend it when it was suspended. A card that exists and is active is
 * left as it is, so its scheduling history is never reset.
 */
export function addToReviews(
  cards: CardRepo,
  input: NewCardInput,
  now: Date = new Date(),
): AddToReviewsResult {
  const id = cardIdFor(input.kind, input.targetId, input.promptMode);
  const existing = cards.getById(id);
  if (existing === null) {
    cards.create({ ...input, createdAt: input.createdAt ?? now });
    return 'added';
  }
  if (existing.suspended) {
    cards.suspend(id, false, now);
    return 'restored';
  }
  return 'already';
}
