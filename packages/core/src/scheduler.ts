import {
  Rating as FsrsRating,
  State as FsrsState,
  dateChrono,
  defineScheduler,
  schedulerDesiredRetentionMiddleware,
  schedulerFuzzingMiddleware,
  schedulerLearningStepsMiddleware,
  schedulerMaximumIntervalMiddleware,
  schedulerMonotonicIntervalMiddleware,
  schedulerScheduledDaysMiddleware,
  schedulerStatsMiddleware,
} from 'ts-fsrs';
import { FSRS6_DEFAULT_WEIGHTS, FSRS6Model, forgettingCurve } from 'ts-fsrs/models/fsrs-6';

import type { CardSchedule, CardState, Rating, ReviewResult } from './types';

/** Desired retention used when none is given. */
export const DEFAULT_DESIRED_RETENTION = 0.9;

/** Maximum interval in days used when none is given (100 years, the FSRS default). */
export const DEFAULT_MAXIMUM_INTERVAL_DAYS = 36_500;

const MS_PER_DAY = 86_400_000;

/** Options for {@link createScheduler}. */
export interface SchedulerOptions {
  /**
   * Target probability of recall when a card comes due, between 0.7 and 0.99.
   * Higher values mean more reviews. Defaults to 0.9.
   */
  desiredRetention?: number;
  /** Upper bound on any interval, in whole days. Defaults to 36,500. */
  maximumIntervalDays?: number;
}

/** A configured FSRS scheduler. All methods are pure: inputs are never mutated. */
export interface Scheduler {
  /** The desired retention this scheduler targets. */
  readonly desiredRetention: number;
  /** The maximum interval this scheduler allows, in days. */
  readonly maximumIntervalDays: number;
  /** Scheduling fields for a card that has never been reviewed, due at `now`. */
  newCard(now: Date): CardSchedule;
  /**
   * Apply one review to a card.
   *
   * Deterministic: the same card, rating and time always give the same result.
   *
   * @param card - the card's current scheduling fields
   * @param rating - the learner's rating
   * @param now - when the review happened
   * @returns the updated card and a log entry for the review
   */
  review(card: CardSchedule, rating: Rating, now: Date): ReviewResult;
}

const definition = defineScheduler({ model: FSRS6Model, chrono: dateChrono }).use(
  schedulerDesiredRetentionMiddleware,
  schedulerFuzzingMiddleware,
  schedulerStatsMiddleware,
  schedulerScheduledDaysMiddleware,
  schedulerLearningStepsMiddleware,
  schedulerMaximumIntervalMiddleware,
  schedulerMonotonicIntervalMiddleware,
);

const RATING_TO_FSRS = {
  again: FsrsRating.Again,
  hard: FsrsRating.Hard,
  good: FsrsRating.Good,
  easy: FsrsRating.Easy,
} as const satisfies Record<Rating, FsrsRating>;

const STATE_TO_FSRS = {
  new: FsrsState.New,
  learning: FsrsState.Learning,
  review: FsrsState.Review,
  relearning: FsrsState.Relearning,
} as const satisfies Record<CardState, FsrsState>;

const SCHEDULE_STATUS = {
  new: 'new',
  learning: 'learning',
  review: 'review',
  relearning: 'learning',
} as const satisfies Record<CardState, string>;

const FSRS_CARD_ID = 'card';

function stateFromFsrs(state: FsrsState): CardState {
  switch (state) {
    case FsrsState.New:
      return 'new';
    case FsrsState.Learning:
      return 'learning';
    case FsrsState.Review:
      return 'review';
    case FsrsState.Relearning:
      return 'relearning';
  }
}

function assertValidDate(value: Date, name: string): void {
  if (Number.isNaN(value.getTime())) {
    throw new RangeError(`${name} must be a valid Date`);
  }
}

function copySchedule(card: CardSchedule): CardSchedule {
  return {
    ...card,
    due: new Date(card.due.getTime()),
    lastReview: card.lastReview === null ? null : new Date(card.lastReview.getTime()),
  };
}

/**
 * Probability that the learner can recall a card at `now`, from the FSRS-6
 * forgetting curve with default weights. Elapsed time is measured in
 * fractional days since the last review.
 *
 * @returns a number in [0, 1]; 0 for a card that has never been reviewed
 * @throws RangeError when `now` is not a valid date
 */
export function retrievability(card: CardSchedule, now: Date): number {
  assertValidDate(now, 'now');
  if (card.state === 'new' || card.lastReview === null || card.stability <= 0) {
    return 0;
  }
  const elapsedDays = Math.max(0, (now.getTime() - card.lastReview.getTime()) / MS_PER_DAY);
  return forgettingCurve(FSRS6_DEFAULT_WEIGHTS, elapsedDays, card.stability);
}

/**
 * Create an FSRS-6 scheduler (via ts-fsrs) with Italia's defaults: desired
 * retention 0.9, short-term learning steps of 1 and 10 minutes, relearning step
 * of 10 minutes, and no interval fuzz (so results are reproducible when logs are
 * replayed).
 *
 * @throws RangeError when an option is out of range
 */
export function createScheduler(options: SchedulerOptions = {}): Scheduler {
  const desiredRetention = options.desiredRetention ?? DEFAULT_DESIRED_RETENTION;
  const maximumIntervalDays = options.maximumIntervalDays ?? DEFAULT_MAXIMUM_INTERVAL_DAYS;

  if (!(desiredRetention >= 0.7 && desiredRetention <= 0.99)) {
    throw new RangeError('desiredRetention must be between 0.7 and 0.99');
  }
  if (!Number.isSafeInteger(maximumIntervalDays) || maximumIntervalDays < 1) {
    throw new RangeError('maximumIntervalDays must be a positive whole number');
  }

  const fsrs = definition.create({
    config: {
      weights: [...FSRS6_DEFAULT_WEIGHTS],
      enableShortTerm: true,
      numRelearningSteps: 1,
      fractionalDays: false,
      desiredRetention,
      learningSteps: ['1m', '10m'],
      relearningSteps: ['10m'],
      allowModelOverride: false,
      enableFuzz: false,
      maximumInterval: maximumIntervalDays,
    },
  });

  return {
    desiredRetention,
    maximumIntervalDays,

    newCard(now) {
      assertValidDate(now, 'now');
      return {
        due: new Date(now.getTime()),
        stability: 0,
        difficulty: 0,
        scheduledDays: 0,
        learningSteps: 0,
        reps: 0,
        lapses: 0,
        state: 'new',
        lastReview: null,
      };
    },

    review(card, rating, now) {
      assertValidDate(now, 'now');
      assertValidDate(card.due, 'card.due');
      if (card.lastReview !== null) {
        assertValidDate(card.lastReview, 'card.lastReview');
        if (now.getTime() < card.lastReview.getTime()) {
          throw new RangeError('now must not be earlier than card.lastReview');
        }
      }

      const result = fsrs.review({
        card: {
          stability: card.stability,
          difficulty: card.difficulty,
          state: STATE_TO_FSRS[card.state],
          dueAt: card.due,
          lastReviewAt: card.lastReview,
          reps: card.reps,
          lapses: card.lapses,
          scheduledDays: card.scheduledDays,
          learningStep: card.learningSteps,
          scheduleStatus: SCHEDULE_STATUS[card.state],
          // ts-fsrs uses the id only to seed interval fuzz, which is disabled.
          cardId: FSRS_CARD_ID,
        },
        grade: RATING_TO_FSRS[rating],
        now,
      });

      const next = result.card;
      const elapsedDays =
        card.lastReview === null
          ? 0
          : Math.max(0, Math.floor((now.getTime() - card.lastReview.getTime()) / MS_PER_DAY));

      return {
        card: {
          due: new Date(next.dueAt.getTime()),
          stability: next.stability,
          difficulty: next.difficulty,
          scheduledDays: next.scheduledDays,
          learningSteps: next.learningStep,
          reps: next.reps,
          lapses: next.lapses,
          state: stateFromFsrs(next.state),
          lastReview: new Date(now.getTime()),
        },
        log: {
          rating,
          reviewedAt: new Date(now.getTime()),
          elapsedDays,
          previous: copySchedule(card),
        },
      };
    },
  };
}
