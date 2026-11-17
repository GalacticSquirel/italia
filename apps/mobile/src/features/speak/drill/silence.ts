/**
 * End-of-speech detection from input levels, so a drill can stop recording
 * hands-free: speech has started (level above `speechLevel` for
 * `minSpeechMs`) and then stayed below `silenceLevel` for `silenceMs`; or the
 * answer window ran out.
 */

/** Tuning for {@link createSilenceDetector}. */
export interface SilenceOptions {
  /** Level (0 to 1) that counts as speech. Default 0.08. */
  speechLevel?: number;
  /** Level below which input counts as silence. Default 0.04. */
  silenceLevel?: number;
  /** Speech needed before silence can end the answer. Default 250 ms. */
  minSpeechMs?: number;
  /** Silence that ends the answer. Default 1200 ms. */
  silenceMs?: number;
  /** Longest answer. Default 10 s. */
  maxMs?: number;
  /** Give up when nothing is said for this long. Default 6 s. */
  noSpeechMs?: number;
}

/** Why recording should stop, or null to keep going. */
export type StopReason = 'endOfSpeech' | 'maxDuration' | 'noSpeech' | null;

/** A detector fed with levels and their times (ms since recording started). */
export interface SilenceDetector {
  push(level: number, atMs: number): StopReason;
  /** Whether speech has been heard. */
  readonly heardSpeech: boolean;
}

/** Create a {@link SilenceDetector}. */
export function createSilenceDetector(options: SilenceOptions = {}): SilenceDetector {
  const speechLevel = options.speechLevel ?? 0.08;
  const silenceLevel = options.silenceLevel ?? 0.04;
  const minSpeechMs = options.minSpeechMs ?? 250;
  const silenceMs = options.silenceMs ?? 1200;
  const maxMs = options.maxMs ?? 10_000;
  const noSpeechMs = options.noSpeechMs ?? 6000;
  let speechStart: number | null = null;
  let speechMs = 0;
  let quietSince: number | null = null;
  let last = 0;
  let heard = false;
  return {
    get heardSpeech() {
      return heard;
    },
    push(level, atMs) {
      const dt = Math.max(0, atMs - last);
      last = atMs;
      if (atMs >= maxMs) return 'maxDuration';
      if (level >= speechLevel) {
        speechStart ??= atMs;
        speechMs += dt;
        if (speechMs >= minSpeechMs) heard = true;
        quietSince = null;
      } else if (level < silenceLevel) {
        quietSince ??= atMs;
        if (heard && atMs - quietSince >= silenceMs) return 'endOfSpeech';
      }
      if (!heard && atMs >= noSpeechMs) return 'noSpeech';
      return null;
    },
  };
}
