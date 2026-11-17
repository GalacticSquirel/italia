/**
 * Battery and heat awareness. Long conversations warm the phone (plan 2b).
 * There is no portable thermal API, so heat is inferred from decode speed:
 * when the GPU or CPU throttles, tokens per second drop well below the
 * conversation's first turns.
 */

/** Battery state, as `expo-battery` reports it. */
export interface BatteryState {
  /** 0 to 1, or null when unknown. */
  level: number | null;
  charging: boolean;
  lowPowerMode: boolean;
}

/** What the tutor should do about power. */
export interface PowerAdvice {
  /** `blocked`: do not start a reply; `saver`: shorter replies; `normal`. */
  mode: 'normal' | 'saver' | 'blocked';
  /** Why, in words for the learner, or null in normal mode. */
  message: string | null;
}

/** Below this battery level (not charging) the tutor stops. */
export const BLOCK_BATTERY = 0.1;
/** Below this battery level (not charging) the tutor saves power. */
export const SAVER_BATTERY = 0.2;
/** Recent decode speed under this share of the early speed means throttling. */
export const THROTTLE_RATIO = 0.6;

/** Whether decode speed suggests the phone is throttling (warm). */
export function looksThrottled(tokensPerSecond: readonly number[]): boolean {
  const speeds = tokensPerSecond.filter((s) => s > 0);
  if (speeds.length < 4) return false;
  const early = Math.max(...speeds.slice(0, 2));
  const recent = speeds.slice(-2);
  return recent.every((s) => s < early * THROTTLE_RATIO);
}

/** Advice for the next reply. */
export function powerAdvice(
  battery: BatteryState,
  tokensPerSecond: readonly number[],
): PowerAdvice {
  const level = battery.level;
  if (!battery.charging && level !== null && level < BLOCK_BATTERY) {
    return {
      mode: 'blocked',
      message: 'Your battery is very low. Charge your phone to keep talking with the tutor.',
    };
  }
  if (looksThrottled(tokensPerSecond)) {
    return {
      mode: 'saver',
      message: 'Your phone is getting warm, so replies are shorter. A short break helps.',
    };
  }
  if (battery.lowPowerMode || (!battery.charging && level !== null && level < SAVER_BATTERY)) {
    return { mode: 'saver', message: 'Saving battery: the tutor keeps its replies short.' };
  }
  return { mode: 'normal', message: null };
}
