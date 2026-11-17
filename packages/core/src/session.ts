import { interleaveItems } from './interleave';
import {
  DEFAULT_SECONDS_PER_ITEM,
  estimateItemSeconds,
  newItemLoadSeconds,
  projectedLoad,
  type ItemSource,
  type LoadForecast,
} from './load';
import { createRng, shuffle, type Rng } from './rng';
import { createScheduler, retrievability, type Scheduler } from './scheduler';
import type { CardKind, CardSchedule } from './types';

/** A card the learner has already met, with its scheduling state and tags. */
export interface SessionCard {
  id: string;
  kind: CardKind;
  schedule: CardSchedule;
  /** Grammar points the card practises (content ids). */
  grammarIds: readonly number[];
  /** Lemmas the card practises (content ids). */
  lemmaIds: readonly number[];
}

/** An item that could be introduced today, supplied in curriculum order. */
export interface NewCandidate {
  /** The card id the item will have (or already has, unreviewed). */
  id: string;
  kind: CardKind;
  grammarIds: readonly number[];
  lemmaIds: readonly number[];
}

/** One item in a planned session. */
export interface SessionItem {
  cardId: string;
  kind: CardKind;
  source: ItemSource;
  grammarIds: readonly number[];
  lemmaIds: readonly number[];
  /** Estimated time for this item in seconds. */
  estimatedSeconds: number;
}

/** Learner settings that shape a session. */
export interface SessionSettings {
  /** Most new items to introduce per local day. Defaults to 20. */
  dailyNewLimit: number;
  /** Daily study time budget in minutes. Defaults to 60. */
  minutesBudget: number;
  /** Share of recent reviews answered correctly (0 to 1), or null with no history. */
  recentAccuracy: number | null;
  /** New items already introduced today. Defaults to 0. */
  alreadyIntroducedToday: number;
}

/** Defaults for {@link SessionSettings}. */
export const DEFAULT_SESSION_SETTINGS: Readonly<SessionSettings> = {
  dailyNewLimit: 20,
  minutesBudget: 60,
  recentAccuracy: null,
  alreadyIntroducedToday: 0,
};

/** Tuning for {@link buildSession}; the defaults suit most learners. */
export interface SessionTuning {
  /** Below this recent accuracy new items are reduced. Defaults to 0.8. */
  accuracyThreshold?: number;
  /** Share of the new-item allowance kept under the threshold. Defaults to 0.5. */
  lowAccuracyFactor?: number;
  /** Days of review load to forecast. Defaults to 7. */
  forecastDays?: number;
  /** Seconds per review by kind. */
  secondsPerItem?: Readonly<Record<CardKind, number>>;
  scheduler?: Scheduler;
  /** Interleaving lookahead, see `interleaveItems`. */
  lookahead?: number;
}

/** Input to {@link buildSession}. */
export interface BuildSessionInput {
  now: Date;
  cards: readonly SessionCard[];
  newCandidates: readonly NewCandidate[];
  settings?: Partial<SessionSettings>;
  /** Random source used to break ties; pass this or `seed`. */
  rng?: Rng;
  /** Seed for a default random source when `rng` is not given. Defaults to 0. */
  seed?: number;
  tuning?: SessionTuning;
}

/**
 * Why fewer new items than the daily limit were planned:
 *
 * - `daily_limit`: more candidates than the remaining daily allowance
 * - `low_accuracy`: recent accuracy is under the threshold
 * - `review_load`: the forecast review load would exceed the time budget
 * - `time_budget`: today's session has no time left
 */
export type NewItemLimitReason = 'daily_limit' | 'low_accuracy' | 'review_load' | 'time_budget';

/** Result of {@link buildSession}. */
export interface SessionPlan {
  /** Items in the order to show them: reviews (interleaved), then new items. */
  items: SessionItem[];
  reviewCount: number;
  newCount: number;
  /** Due reviews left out because they did not fit the time budget. */
  deferredReviewCount: number;
  /** Sum of the items' estimated seconds. */
  estimatedSeconds: number;
  newItems: {
    /** New items allowed after the daily limit and accuracy throttle. */
    allowance: number;
    limitedBy: NewItemLimitReason[];
  };
  /** Forecast review load for existing cards, for display and throttling. */
  forecast: LoadForecast;
}

function resolveSettings(partial: Partial<SessionSettings> = {}): SessionSettings {
  const settings = { ...DEFAULT_SESSION_SETTINGS, ...partial };
  if (!Number.isSafeInteger(settings.dailyNewLimit) || settings.dailyNewLimit < 0) {
    throw new RangeError('dailyNewLimit must be a non-negative whole number');
  }
  if (!(Number.isFinite(settings.minutesBudget) && settings.minutesBudget > 0)) {
    throw new RangeError('minutesBudget must be positive');
  }
  const accuracy = settings.recentAccuracy;
  if (accuracy !== null && !(accuracy >= 0 && accuracy <= 1)) {
    throw new RangeError('recentAccuracy must be between 0 and 1, or null');
  }
  if (
    !Number.isSafeInteger(settings.alreadyIntroducedToday) ||
    settings.alreadyIntroducedToday < 0
  ) {
    throw new RangeError('alreadyIntroducedToday must be a non-negative whole number');
  }
  return settings;
}

/** Retrievability rounded so near-ties are ordered by the random source. */
const URGENCY_PRECISION = 100;

/**
 * Build today's session queue. Pure and deterministic for a given random
 * source.
 *
 * 1. **Reviews**: cards due at `now` (any FSRS state except `new`; never
 *    `minimal_pair`, which has its own adaptive selection), most at risk of
 *    being forgotten first, cut to the time budget, then interleaved so the
 *    same lemma, grammar point and kind do not cluster.
 * 2. **New items**, in curriculum order, up to `dailyNewLimit` minus those
 *    already introduced today; halved when recent accuracy is under 0.8; and
 *    stopped when the forecast review load over the next 7 days (existing
 *    cards plus the new items) would exceed the daily budget times 7, or
 *    when today's session is out of time.
 *
 * Use {@link startSessionQueue} to run the plan with in-session repeats.
 */
export function buildSession(input: BuildSessionInput): SessionPlan {
  const settings = resolveSettings(input.settings);
  const tuning = input.tuning ?? {};
  const rng = input.rng ?? createRng(input.seed ?? 0);
  const table = tuning.secondsPerItem ?? DEFAULT_SECONDS_PER_ITEM;
  const scheduler = tuning.scheduler ?? createScheduler();
  const forecastDays = tuning.forecastDays ?? 7;
  const accuracyThreshold = tuning.accuracyThreshold ?? 0.8;
  const lowAccuracyFactor = tuning.lowAccuracyFactor ?? 0.5;
  const budgetSeconds = settings.minutesBudget * 60;
  const now = input.now;

  // 1. Due reviews, most urgent first, within the time budget.
  const due = input.cards.filter(
    (c) =>
      c.kind !== 'minimal_pair' &&
      c.schedule.state !== 'new' &&
      c.schedule.due.getTime() <= now.getTime(),
  );
  const urgency = new Map(
    due.map((c) => [
      c.id,
      Math.round(retrievability(c.schedule, now) * URGENCY_PRECISION) / URGENCY_PRECISION,
    ]),
  );
  const byUrgency = shuffle(due, rng).sort(
    (a, b) => (urgency.get(a.id) ?? 0) - (urgency.get(b.id) ?? 0),
  );
  const reviews: SessionItem[] = [];
  let usedSeconds = 0;
  for (const c of byUrgency) {
    const seconds = estimateItemSeconds(c.kind, 'review', table);
    if (usedSeconds + seconds > budgetSeconds) break;
    usedSeconds += seconds;
    reviews.push(toItem(c, 'review', seconds));
  }
  const orderedReviews = interleaveItems(
    reviews,
    tuning.lookahead === undefined ? {} : { lookahead: tuning.lookahead },
  );

  // 2. New items.
  const forecast = projectedLoad({
    now,
    cards: input.cards,
    days: forecastDays,
    scheduler,
    secondsPerItem: table,
  });
  const limitedBy = new Set<NewItemLimitReason>();
  let allowance = Math.max(0, settings.dailyNewLimit - settings.alreadyIntroducedToday);
  if (settings.recentAccuracy !== null && settings.recentAccuracy < accuracyThreshold) {
    allowance = Math.floor(allowance * lowAccuracyFactor);
    limitedBy.add('low_accuracy');
  }
  if (input.newCandidates.length > allowance && !limitedBy.has('low_accuracy')) {
    limitedBy.add('daily_limit');
  }

  const loadBudget = budgetSeconds * forecastDays;
  const loadPerKind = new Map<CardKind, number>();
  let projected = forecast.totalSeconds;
  const fresh: SessionItem[] = [];
  for (const candidate of input.newCandidates.slice(0, allowance)) {
    const today = estimateItemSeconds(candidate.kind, 'new', table);
    let load = loadPerKind.get(candidate.kind);
    if (load === undefined) {
      load = newItemLoadSeconds(candidate.kind, now, forecastDays, scheduler, table);
      loadPerKind.set(candidate.kind, load);
    }
    const overLoad = projected + load > loadBudget;
    const overTime = usedSeconds + today > budgetSeconds;
    if (overLoad) limitedBy.add('review_load');
    if (overTime) limitedBy.add('time_budget');
    if (overLoad || overTime) break;
    projected += load;
    usedSeconds += today;
    fresh.push(toItem(candidate, 'new', today));
  }

  const items = [...orderedReviews, ...fresh];
  return {
    items,
    reviewCount: orderedReviews.length,
    newCount: fresh.length,
    deferredReviewCount: due.length - orderedReviews.length,
    estimatedSeconds: items.reduce((sum, i) => sum + i.estimatedSeconds, 0),
    newItems: { allowance, limitedBy: [...limitedBy] },
    forecast,
  };
}

function toItem(
  source: Pick<SessionCard, 'id' | 'kind' | 'grammarIds' | 'lemmaIds'>,
  kind: ItemSource,
  estimatedSeconds: number,
): SessionItem {
  return {
    cardId: source.id,
    kind: source.kind,
    source: kind,
    grammarIds: source.grammarIds,
    lemmaIds: source.lemmaIds,
    estimatedSeconds,
  };
}
