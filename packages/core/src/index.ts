/**
 * `@italia/core`: Italia's learning logic in pure TypeScript.
 *
 * This package must never import React, React Native or Expo. Screens in the
 * app call into it; everything here is unit tested in Node.
 *
 * @packageDocumentation
 */

export {
  createScheduler,
  DEFAULT_DESIRED_RETENTION,
  DEFAULT_MAXIMUM_INTERVAL_DAYS,
  type Scheduler,
  type SchedulerOptions,
} from './scheduler';
export {
  CARD_KINDS,
  CARD_STATES,
  PROMPT_MODES,
  RATINGS,
  type CardKind,
  type CardSchedule,
  type CardState,
  type PromptMode,
  type Rating,
  type ReviewOutcomeLog,
  type ReviewResult,
} from './types';
