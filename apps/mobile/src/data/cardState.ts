/**
 * Card FSRS state as a cache of the review log (ADR 0002): recording a review
 * against the card's current stored state, and rebuilding states by replaying
 * logs when the cache may be stale (logs merged from elsewhere, a changed
 * desired retention, or a review older than the card's last one).
 */
import { eq, inArray } from 'drizzle-orm';

import { rebuildCardState, type Rating, type Scheduler } from '@italia/core';

import { appMeta, card, reviewLog } from '@/db/schema';
import type { AppDatabase } from '@/db/types';

import { CardNotFoundError, toSchedule } from './CardRepo';
import type { IdGenerator } from './ids';
import { META_KEYS } from './MetaRepo';
import { createReviewLogRepo } from './ReviewLogRepo';
import type { CardRow, ReviewLogRow } from './rows';
import { chunk, MAX_IDS_PER_QUERY } from './util';

/**
 * Rebuild the FSRS state of `cardIds` by replaying all their logs. Cards
 * without logs are left alone.
 *
 * @returns the number of cards rebuilt
 */
export function rebuildCards(
  tx: AppDatabase,
  cardIds: Iterable<string>,
  scheduler: Scheduler,
): number {
  let rebuilt = 0;
  for (const part of chunk([...new Set(cardIds)], MAX_IDS_PER_QUERY)) {
    const logs = tx
      .select({
        id: reviewLog.id,
        cardId: reviewLog.cardId,
        rating: reviewLog.rating,
        reviewedAt: reviewLog.reviewedAt,
      })
      .from(reviewLog)
      .where(inArray(reviewLog.cardId, part))
      .all();
    const byCard = new Map<string, typeof logs>();
    for (const log of logs) {
      const list = byCard.get(log.cardId);
      if (list) list.push(log);
      else byCard.set(log.cardId, [log]);
    }
    for (const [cardId, cardLogs] of byCard) {
      // createdAt defaults to the first log, so every device gets the same state.
      const schedule = rebuildCardState(cardLogs, { scheduler });
      tx.update(card).set(schedule).where(eq(card.id, cardId)).run();
      rebuilt += 1;
    }
  }
  return rebuilt;
}

/** Ids of every card that has review logs. */
export function cardsWithLogs(tx: AppDatabase): string[] {
  return tx
    .selectDistinct({ cardId: reviewLog.cardId })
    .from(reviewLog)
    .all()
    .map((r) => r.cardId);
}

/**
 * Note that card states now match `desiredRetention` (call inside the
 * transaction that rebuilt them).
 */
export function markCardStatesRetention(
  tx: AppDatabase,
  desiredRetention: number,
  now: Date = new Date(),
): void {
  const value = String(desiredRetention);
  tx.insert(appMeta)
    .values({ key: META_KEYS.cardStateRetention, value, updatedAt: now })
    .onConflictDoUpdate({ target: appMeta.key, set: { value, updatedAt: now } })
    .run();
}

/** The desired retention card states were last computed with, or null if unknown. */
function cardStatesRetention(db: AppDatabase): string | null {
  return (
    db
      .select({ value: appMeta.value })
      .from(appMeta)
      .where(eq(appMeta.key, META_KEYS.cardStateRetention))
      .get()?.value ?? null
  );
}

/**
 * Rebuild every card with logs using `scheduler` and record its retention.
 * Call inside a transaction.
 *
 * @returns the number of cards rebuilt
 */
export function rebuildAllCards(tx: AppDatabase, scheduler: Scheduler, now?: Date): number {
  const rebuilt = rebuildCards(tx, cardsWithLogs(tx), scheduler);
  markCardStatesRetention(tx, scheduler.desiredRetention, now);
  return rebuilt;
}

/**
 * Make every card's state match `scheduler`'s desired retention.
 *
 * Card states are a replay of the logs with the current desired retention
 * (that is what sync rebuilds on every device). When the learner changes the
 * retention on this device, the cards here still hold states computed with
 * the old value, so they would differ from the other devices' rebuilt states
 * and from their own replay. This rebuilds all cards once whenever the
 * retention differs from the one the states were last computed with (and
 * once after upgrading from a version that did not record it).
 *
 * Cheap when nothing changed: one metadata read.
 *
 * @returns the number of cards rebuilt
 */
export function alignCardStates(
  db: AppDatabase,
  scheduler: Scheduler,
  now: Date = new Date(),
): number {
  if (cardStatesRetention(db) === String(scheduler.desiredRetention)) return 0;
  return db.transaction((tx) => rebuildAllCards(tx, scheduler, now));
}

/** One review to record with {@link reviewCard}. */
export interface ReviewCardInput {
  cardId: string;
  rating: Rating;
  /** What the learner typed or said, if anything. */
  answer: string | null;
  latencyMs: number;
  reviewedAt: Date;
  deviceId: string;
  /** The scheduler configured by the learner's settings. */
  scheduler: Scheduler;
  /** Log id; defaults to a new UUID. */
  logId?: string;
}

/** What {@link reviewCard} stored. */
export interface ReviewCardResult {
  log: ReviewLogRow;
  /** The card with its new FSRS state. */
  card: CardRow;
}

/**
 * Record a review atomically: append its `review_log` row and update the
 * card's FSRS state, in one transaction.
 *
 * The next state is computed from the card as stored now, not from a copy
 * the caller may have read earlier (a sync, or another screen, may have
 * changed it since). When the review is older than the card's last review
 * (for example another device with a clock ahead of this one reviewed the
 * card and sync merged it), the scheduler cannot apply it on top, so the
 * card is rebuilt by replaying all its logs in time order instead, which is
 * also what every other device computes.
 *
 * @throws CardNotFoundError when the card does not exist
 */
export function reviewCard(
  db: AppDatabase,
  input: ReviewCardInput,
  newId: IdGenerator,
): ReviewCardResult {
  return db.transaction((tx) => {
    const current = tx.select().from(card).where(eq(card.id, input.cardId)).get();
    if (!current) throw new CardNotFoundError(input.cardId);
    const log = createReviewLogRepo(tx, newId).append({
      id: input.logId ?? newId(),
      cardId: input.cardId,
      rating: input.rating,
      answer: input.answer,
      latencyMs: input.latencyMs,
      reviewedAt: input.reviewedAt,
      deviceId: input.deviceId,
    });
    const inOrder =
      current.lastReview === null || current.lastReview.getTime() <= input.reviewedAt.getTime();
    if (inOrder) {
      const next = input.scheduler.review(toSchedule(current), input.rating, input.reviewedAt);
      tx.update(card).set(next.card).where(eq(card.id, input.cardId)).run();
    } else {
      rebuildCards(tx, [input.cardId], input.scheduler);
    }
    const updated = tx.select().from(card).where(eq(card.id, input.cardId)).get();
    if (!updated) throw new CardNotFoundError(input.cardId);
    return { log, card: updated };
  });
}
