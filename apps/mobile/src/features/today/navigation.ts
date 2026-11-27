import { router, type Href } from 'expo-router';

import type { StepTarget } from './dailyPath';

/**
 * Open a step's screen. From Today it is pushed; from the end of another step
 * it replaces that screen, so Back always returns to Today.
 */
export function openStep(target: StepTarget, mode: 'push' | 'replace' = 'push'): void {
  const href = target as Href;
  if (mode === 'replace') router.replace(href);
  else router.push(href);
}

/** Leave a step's screen, back to where it was opened from (Today, or Practice). */
export function closeStep(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
