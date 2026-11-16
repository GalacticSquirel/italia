import type { SessionItem } from './session';
import type { Rating } from './types';

/** An item waiting in a session, with how many times it has been shown. */
export interface QueueEntry {
  item: SessionItem;
  /** 1 on first presentation, 2 on the first repeat, and so on. */
  attempt: number;
}

/** One answer given during a session. */
export interface CompletedEntry {
  item: SessionItem;
  attempt: number;
  rating: Rating;
}

/** State of a running session. Immutable: every update returns a new queue. */
export interface SessionQueue {
  /** Items still to show; the first is the current one. */
  readonly pending: readonly QueueEntry[];
  /** Every answer so far, in order (an item answered twice appears twice). */
  readonly completed: readonly CompletedEntry[];
}

/** Options for {@link recordAnswer}. */
export interface QueueOptions {
  /** Number of other items shown before a repeated item comes back. Defaults to 3. */
  retryGap?: number;
  /**
   * Presentations of one item allowed in a session. After the last, the item
   * is retired and FSRS brings it back later. Defaults to 4.
   */
  maxAttempts?: number;
}

/** Start a session queue from a plan's items. */
export function startSessionQueue(items: readonly SessionItem[]): SessionQueue {
  return { pending: items.map((item) => ({ item, attempt: 1 })), completed: [] };
}

/** The item to show now, or undefined when the session is finished. */
export function currentEntry(queue: SessionQueue): QueueEntry | undefined {
  return queue.pending[0];
}

function needsRepeat(entry: QueueEntry, rating: Rating): boolean {
  switch (rating) {
    case 'again':
      return true;
    case 'hard':
    case 'good':
      // A new item must be recalled correctly once more after a gap.
      return entry.item.source === 'new' && entry.attempt === 1;
    case 'easy':
      return false;
  }
}

/**
 * Record the rating for the current item and advance. An item rated `again`
 * comes back after `retryGap` other items (or at the end if fewer remain), as
 * does a new item on its first presentation unless rated `easy`, so items are
 * learned to criterion within the session.
 *
 * @throws RangeError when the queue is empty or an option is invalid
 */
export function recordAnswer(
  queue: SessionQueue,
  rating: Rating,
  options: QueueOptions = {},
): SessionQueue {
  const retryGap = options.retryGap ?? 3;
  const maxAttempts = options.maxAttempts ?? 4;
  if (!Number.isSafeInteger(retryGap) || retryGap < 0) {
    throw new RangeError('retryGap must be a non-negative whole number');
  }
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError('maxAttempts must be a positive whole number');
  }
  const [entry, ...rest] = queue.pending;
  if (entry === undefined) {
    throw new RangeError('the session queue is empty');
  }
  const completed = [...queue.completed, { item: entry.item, attempt: entry.attempt, rating }];
  if (needsRepeat(entry, rating) && entry.attempt < maxAttempts) {
    const at = Math.min(retryGap, rest.length);
    rest.splice(at, 0, { item: entry.item, attempt: entry.attempt + 1 });
  }
  return { pending: rest, completed };
}
