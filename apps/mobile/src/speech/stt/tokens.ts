import type { TimedText } from '@italia/core';

/**
 * Word timings from a transducer's subword tokens: a token starting with the
 * SentencePiece word marker (`▁`) or a space opens a new word. Timestamps are
 * token start times in seconds; `durations` (TDT models) give token lengths,
 * otherwise a word ends where the next starts (the last at its token start
 * plus `lastTokenMs`).
 */
export function wordsFromTokens(
  tokens: readonly string[],
  timestamps: readonly number[],
  durations: readonly number[] = [],
  lastTokenMs = 200,
): TimedText[] {
  const words: TimedText[] = [];
  tokens.forEach((token, i) => {
    const startMs = Math.round((timestamps[i] ?? 0) * 1000);
    const duration = durations[i];
    const endMs =
      duration !== undefined && duration > 0
        ? startMs + Math.round(duration * 1000)
        : Math.round((timestamps[i + 1] ?? (timestamps[i] ?? 0) + lastTokenMs / 1000) * 1000);
    const opens = /^[▁ ]/u.test(token) || words.length === 0;
    const text = token.replace(/^[▁ ]+/u, '');
    const last = words.at(-1);
    if (opens || !last) {
      if (text === '' && !opens) return;
      words.push({ text, startMs, endMs });
    } else {
      words[words.length - 1] = { text: last.text + text, startMs: last.startMs, endMs };
    }
  });
  return words.filter((w) => w.text !== '');
}
