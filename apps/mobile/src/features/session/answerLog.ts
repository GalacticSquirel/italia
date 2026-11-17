import type { Rating } from '@italia/core';

/**
 * How an answer is stored in `review_log.answer`. A plain answer is stored
 * as typed. When the learner overrides the grade ("I was right"), the answer
 * is stored as JSON recording the override, so it stays auditable:
 * `{"text": "...", "override": {"from": "again", "to": "good"}}`.
 */
export interface LoggedAnswer {
  text: string;
  override?: { from: Rating; to: Rating };
}

/** Encode an answer for the review log. */
export function encodeAnswer(answer: LoggedAnswer): string {
  if (!answer.override) return answer.text;
  return JSON.stringify({ text: answer.text, override: answer.override });
}

const RATINGS = new Set<unknown>(['again', 'hard', 'good', 'easy']);

/** Decode a stored answer; anything that is not an override record is plain text. */
export function decodeAnswer(stored: string): LoggedAnswer {
  if (!stored.startsWith('{')) return { text: stored };
  try {
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed === 'object' && parsed !== null && 'text' in parsed && 'override' in parsed) {
      const { text, override } = parsed;
      if (
        typeof text === 'string' &&
        typeof override === 'object' &&
        override !== null &&
        RATINGS.has((override as { from?: unknown }).from) &&
        RATINGS.has((override as { to?: unknown }).to)
      ) {
        return { text, override: override as { from: Rating; to: Rating } };
      }
    }
  } catch {
    // Not JSON: a typed answer that happens to start with a brace.
  }
  return { text: stored };
}
