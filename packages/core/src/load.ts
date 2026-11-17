import { createScheduler, type Scheduler } from './scheduler';
import type { CardKind, CardSchedule } from './types';

const MS_PER_DAY = 86_400_000;
/** Guards the forecast simulation against a pathological schedule. */
const MAX_SIMULATED_REVIEWS_PER_CARD = 64;

/**
 * Estimated seconds to answer one review of each kind, including reading the
 * prompt and the feedback. Starting values to be calibrated from review logs.
 */
export const DEFAULT_SECONDS_PER_ITEM: Readonly<Record<CardKind, number>> = {
  recognition: 6,
  cloze_production: 10,
  grammar_cloze: 12,
  grammar_drill: 12,
  dictation: 15,
  spoken_prompt: 12,
  sentence_production: 20,
  minimal_pair: 5,
};

/**
 * A new item costs this many times a review: the introduction plus its
 * first retrieval and the in-session repeat to criterion.
 */
export const NEW_ITEM_COST_FACTOR = 2.5;

/** Whether a session item is a due review or a newly introduced item. */
export type ItemSource = 'review' | 'new';

/**
 * Estimated seconds for one session item.
 *
 * @param table - seconds per review by kind; defaults to {@link DEFAULT_SECONDS_PER_ITEM}
 */
export function estimateItemSeconds(
  kind: CardKind,
  source: ItemSource,
  table: Readonly<Record<CardKind, number>> = DEFAULT_SECONDS_PER_ITEM,
): number {
  const base = table[kind];
  switch (source) {
    case 'review':
      return base;
    case 'new':
      return base * NEW_ITEM_COST_FACTOR;
  }
}

/** A card as the forecaster needs it. */
export interface ForecastCard {
  kind: CardKind;
  schedule: CardSchedule;
}

/** Input to {@link projectedLoad}. */
export interface ProjectedLoadInput {
  now: Date;
  cards: readonly ForecastCard[];
  /** Number of days to forecast, a positive whole number. Defaults to 7. */
  days?: number;
  /** Scheduler used to simulate later reviews; defaults to `createScheduler()`. */
  scheduler?: Scheduler;
  /** Seconds per review by kind; defaults to {@link DEFAULT_SECONDS_PER_ITEM}. */
  secondsPerItem?: Readonly<Record<CardKind, number>>;
}

/** Forecast reviews for one day. */
export interface DayLoad {
  /** 0 for the 24 hours from `now` (including overdue cards), 1 for the next 24, and so on. */
  day: number;
  reviews: number;
  seconds: number;
}

/** Result of {@link projectedLoad}. */
export interface LoadForecast {
  days: DayLoad[];
  totalReviews: number;
  totalSeconds: number;
}

/**
 * Forecast the review load for the coming days from FSRS due dates.
 *
 * Each card is reviewed at its due time (overdue cards at `now`) and, to
 * count repeat reviews inside the horizon, assumed to be answered `good`, so
 * the forecast slightly underestimates when lapses happen. Days are 24-hour
 * windows starting at `now`. Cards never reviewed (`new` state) and
 * `minimal_pair` cards (not scheduled by FSRS) are ignored.
 *
 * @throws RangeError when `days` is not a positive whole number
 */
export function projectedLoad(input: ProjectedLoadInput): LoadForecast {
  const days = input.days ?? 7;
  if (!Number.isSafeInteger(days) || days < 1) {
    throw new RangeError('days must be a positive whole number');
  }
  const scheduler = input.scheduler ?? createScheduler();
  const table = input.secondsPerItem ?? DEFAULT_SECONDS_PER_ITEM;
  const start = input.now.getTime();
  const end = start + days * MS_PER_DAY;
  const load: DayLoad[] = Array.from({ length: days }, (_, day) => ({
    day,
    reviews: 0,
    seconds: 0,
  }));

  for (const { kind, schedule } of input.cards) {
    if (kind === 'minimal_pair' || schedule.state === 'new') continue;
    let current = schedule;
    for (let n = 0; n < MAX_SIMULATED_REVIEWS_PER_CARD; n++) {
      const at = Math.max(start, current.due.getTime());
      if (at >= end) break;
      const bucket = load[Math.floor((at - start) / MS_PER_DAY)];
      if (bucket === undefined) break;
      bucket.reviews += 1;
      bucket.seconds += table[kind];
      current = scheduler.review(current, 'good', new Date(at)).card;
    }
  }

  return {
    days: load,
    totalReviews: load.reduce((sum, d) => sum + d.reviews, 0),
    totalSeconds: load.reduce((sum, d) => sum + d.seconds, 0),
  };
}

/**
 * Seconds a new item of `kind` introduced at `now` adds over the horizon:
 * its introduction plus forecast reviews after it, assuming `good` answers.
 */
export function newItemLoadSeconds(
  kind: CardKind,
  now: Date,
  days: number,
  scheduler: Scheduler,
  table: Readonly<Record<CardKind, number>>,
): number {
  const { card } = scheduler.review(scheduler.newCard(now), 'good', now);
  const later = projectedLoad({
    now,
    cards: [{ kind, schedule: card }],
    days,
    scheduler,
    secondsPerItem: table,
  });
  return estimateItemSeconds(kind, 'new', table) + later.totalSeconds;
}
