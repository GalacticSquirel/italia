/** Longest stretch counted as study without an interaction (idle time is not study). */
export const IDLE_CAP_MS = 5 * 60_000;

/**
 * Measures active study time: time while the app is in the foreground,
 * paused while it is in the background, with each stretch between
 * interactions capped at {@link IDLE_CAP_MS}.
 */
export interface ActiveTimer {
  /** Start or continue counting (app in the foreground). */
  resume(now: number): void;
  /** Stop counting (app in the background, or the session ended). */
  pause(now: number): void;
  /** Milliseconds counted since the last call, ending the current stretch at `now`. */
  take(now: number): number;
  /** Milliseconds counted in total. */
  totalMs(now: number): number;
  readonly running: boolean;
}

/** Create an {@link ActiveTimer}, initially paused. */
export function createActiveTimer(idleCapMs: number = IDLE_CAP_MS): ActiveTimer {
  let since: number | null = null;
  let pending = 0;
  let taken = 0;
  const close = (now: number) => {
    if (since === null) return;
    pending += Math.min(Math.max(0, now - since), idleCapMs);
    since = now;
  };
  return {
    resume(now) {
      since ??= now;
    },
    pause(now) {
      close(now);
      since = null;
    },
    take(now) {
      close(now);
      const ms = pending;
      taken += ms;
      pending = 0;
      return ms;
    },
    totalMs(now) {
      const open = since === null ? 0 : Math.min(Math.max(0, now - since), idleCapMs);
      return taken + pending + open;
    },
    get running() {
      return since !== null;
    },
  };
}
