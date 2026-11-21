/**
 * Tutor diagnostics on the device log (logcat on Android, the system log on
 * iOS), in release builds too: the raw model output of each turn, which
 * annotations the guard rails dropped and why, GPU fallback and prompt-cache
 * misses. Read them with `adb logcat -s ReactNativeJS`. They never leave the
 * device.
 */
export function tutorLog(message: string): void {
  console.info(`[tutor] ${message}`);
}
