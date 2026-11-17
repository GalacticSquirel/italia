/**
 * Word timings for karaoke highlighting. When the speech engine gives no
 * word timings, they are estimated by character position: a token starts at
 * the same fraction of the audio as its first character has of the text.
 * Estimates are labelled as such in the reader.
 */

/** A token's character span in its sentence (UTF-16, end exclusive). */
export interface TokenSpan {
  start: number;
  end: number;
}

/** One `[startMs, endMs]` pair per token. */
export type WordTimings = readonly (readonly [number, number])[];

/** Device voices speak Italian at roughly this many characters a second at rate 1. */
export const DEVICE_CHARS_PER_SECOND = 14;

/**
 * Estimate token timings over `durationMs` of audio by character position.
 * Each token runs from its first character to the next token's first
 * character (so the pause after punctuation belongs to the word before it).
 */
export function estimateTimings(
  text: string,
  tokens: readonly TokenSpan[],
  durationMs: number,
): WordTimings {
  const length = Math.max(1, text.length);
  const at = (char: number) => Math.round((Math.min(char, length) / length) * durationMs);
  return tokens.map((t, i) => [at(t.start), at(tokens[i + 1]?.start ?? length)] as const);
}

/** Estimated length of device speech for `text` at `rate`, in milliseconds. */
export function estimateDeviceDurationMs(text: string, rate: number): number {
  return Math.round((text.length / (DEVICE_CHARS_PER_SECOND * rate)) * 1000);
}

/**
 * Engine word timings mapped onto the sentence's tokens, or null when they
 * do not line up one to one (the engine split words differently).
 */
export function engineTimings(
  timings: readonly { startMs: number; endMs: number }[],
  tokens: readonly TokenSpan[],
): WordTimings | null {
  if (timings.length === 0 || timings.length !== tokens.length) return null;
  return timings.map((t) => [t.startMs, t.endMs] as const);
}

/** The token being spoken `elapsedMs` into the audio (the last one once it has passed). */
export function wordAt(timings: WordTimings, elapsedMs: number): number | null {
  if (timings.length === 0) return null;
  let index = 0;
  for (let i = 0; i < timings.length; i++) {
    const t = timings[i];
    if (t && t[0] <= elapsedMs) index = i;
    else break;
  }
  return index;
}

/** The token containing (or starting after) character `charIndex`. */
export function tokenAtChar(tokens: readonly TokenSpan[], charIndex: number): number | null {
  if (tokens.length === 0) return null;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t && charIndex < t.end) return i;
  }
  return tokens.length - 1;
}

/** A word's place in a recorded clip, over the clip's normalised text. */
export interface RecordedWord {
  charStart: number;
  charEnd: number;
  startMs: number;
  endMs: number;
}

/**
 * Recorded word timings mapped onto the sentence's tokens by character
 * overlap (`text` must be the clip's normalised text). A token with no
 * aligned word (a number, say) spans the gap between its neighbours. Null
 * when fewer than half the tokens line up, so the caller estimates instead.
 */
export function recordedTimings(
  words: readonly RecordedWord[],
  tokens: readonly TokenSpan[],
  durationMs: number,
): WordTimings | null {
  if (tokens.length === 0 || words.length === 0) return null;
  const found = tokens.map(
    (t) => words.find((w) => w.charStart < t.end && t.start < w.charEnd) ?? null,
  );
  if (found.filter(Boolean).length * 2 < tokens.length) return null;
  return found.map((w, i) => {
    if (w) return [w.startMs, w.endMs] as const;
    const before = found.slice(0, i).reverse().find(Boolean);
    const after = found.slice(i + 1).find(Boolean);
    return [before?.endMs ?? 0, after?.startMs ?? durationMs] as const;
  });
}
