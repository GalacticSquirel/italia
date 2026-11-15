import { createScheduler, type Scheduler } from './scheduler';
import type { CardSchedule, Rating } from './types';

/** The fields of a `review_log` row that replay needs. */
export interface ReplayLog {
  /** Device-generated UUID; unique across devices. */
  id: string;
  cardId: string;
  rating: Rating;
  reviewedAt: Date;
}

/** Total order on logs: by review time, then by id. */
export function compareLogs(
  a: Pick<ReplayLog, 'id' | 'reviewedAt'>,
  b: Pick<ReplayLog, 'id' | 'reviewedAt'>,
): number {
  const byTime = a.reviewedAt.getTime() - b.reviewedAt.getTime();
  if (byTime !== 0) return byTime;
  if (a.id < b.id) return -1;
  return a.id > b.id ? 1 : 0;
}

/**
 * Union of two log sets by id, sorted by review time then id. Logs are
 * immutable, so a duplicate id is the same row; the copy from `a` is kept.
 * Commutative, associative and idempotent on well-formed logs, so devices can
 * merge in any order and converge. Inputs are not mutated.
 */
export function mergeLogs<T extends Pick<ReplayLog, 'id' | 'reviewedAt'>>(
  a: readonly T[],
  b: readonly T[],
): T[] {
  const byId = new Map<string, T>();
  for (const log of a) if (!byId.has(log.id)) byId.set(log.id, log);
  for (const log of b) if (!byId.has(log.id)) byId.set(log.id, log);
  return [...byId.values()].sort(compareLogs);
}

/** Options for {@link rebuildCardState}. */
export interface ReplayOptions {
  /** Defaults to `createScheduler()`; must match the scheduler used live. */
  scheduler?: Scheduler;
  /**
   * When the card was created. Used for the starting state; required when
   * there are no logs. Defaults to the first log's time.
   */
  createdAt?: Date;
}

/**
 * Rebuild one card's scheduling state by replaying its review logs through
 * the scheduler in {@link compareLogs} order. Deterministic: the same set of
 * logs, in any order, always gives the same state (the scheduler has no
 * fuzz), so merged logs from several devices converge.
 *
 * @throws RangeError when the logs belong to more than one card, or when
 *   there are no logs and no `createdAt`
 */
export function rebuildCardState(
  logs: readonly ReplayLog[],
  options: ReplayOptions = {},
): CardSchedule {
  const scheduler = options.scheduler ?? createScheduler();
  const sorted = [...logs].sort(compareLogs);
  const first = sorted[0];
  if (first !== undefined && sorted.some((log) => log.cardId !== first.cardId)) {
    throw new RangeError('rebuildCardState needs the logs of a single card');
  }
  const createdAt = options.createdAt ?? first?.reviewedAt;
  if (createdAt === undefined) {
    throw new RangeError('createdAt is required when there are no logs');
  }
  let card = scheduler.newCard(createdAt);
  for (const log of sorted) {
    card = scheduler.review(card, log.rating, log.reviewedAt).card;
  }
  return card;
}

/**
 * Rebuild the state of every card in `logs`, keyed by card id. Cards with
 * no logs are absent; start those from `scheduler.newCard`.
 */
export function rebuildCardStates(
  logs: readonly ReplayLog[],
  options: Pick<ReplayOptions, 'scheduler'> = {},
): Map<string, CardSchedule> {
  const byCard = new Map<string, ReplayLog[]>();
  for (const log of logs) {
    const list = byCard.get(log.cardId);
    if (list === undefined) byCard.set(log.cardId, [log]);
    else list.push(log);
  }
  const states = new Map<string, CardSchedule>();
  for (const [cardId, cardLogs] of byCard) {
    states.set(cardId, rebuildCardState(cardLogs, options));
  }
  return states;
}
