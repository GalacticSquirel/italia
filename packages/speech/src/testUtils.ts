import type { RecognizedPhone } from './align';

/** A phone for {@link timeline}: label, duration in ms, probability, and optional extras. */
export type PhoneSpec =
  | readonly [string, number]
  | readonly [string, number, number]
  | readonly [string, number, number, Partial<RecognizedPhone>];

/** Build back-to-back recognizer segments from (label, duration, prob) specs. */
export function timeline(specs: readonly PhoneSpec[], startMs = 0): RecognizedPhone[] {
  let t = startMs;
  return specs.map(([phone, dur, prob = 0.9, extra = {}]) => {
    const p: RecognizedPhone = { phone, startMs: t, endMs: t + dur, prob, ...extra };
    t += dur;
    return p;
  });
}
