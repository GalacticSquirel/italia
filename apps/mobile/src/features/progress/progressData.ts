import {
  addDays,
  estimateCefr,
  knownLemmaCount,
  projectedLoad,
  projectHoursToNextLevel,
  rebuildCardStates,
  type CefrEstimate,
  type DayLoad,
  type HoursProjection,
  type LemmaCard,
  type LocalDate,
  type ReplayLog,
} from '@italia/core';

import { toSchedule, type CardRow, type Repositories } from '@/data';
import { getContentIndex } from '@/features/study/content';
import { unlockedGrammar } from '@/features/study/curriculum';
import { schedulerFor } from '@/features/study/planning';
import { isShownKind } from '@/features/study/prompts';
import { deviceLocalDate, startOfLocalDate } from '@/features/study/time';

/** Days of history used to measure the learning rate. */
export const OBSERVATION_DAYS = 30;
/** Days shown in the study calendar. */
export const CALENDAR_DAYS = 30;
/** Days of review load forecast. */
export const FORECAST_DAYS = 7;

/** The card kind that measures whether a word is known: recall of the word in context. */
const KNOWN_WORD_KIND = 'cloze_production';

/** One day in the study calendar. */
export interface CalendarDay {
  date: LocalDate;
  minutes: number;
}

/** Everything the Progress screen shows. */
export interface ProgressData {
  knownWords: number;
  /** Total active study hours. */
  hours: number;
  cefr: CefrEstimate;
  /** Hours to the next level at the recent rate, or null without enough data. */
  projection: HoursProjection | null;
  /** Forecast reviews per day for the next week. */
  load: DayLoad[];
  /** Study minutes per local day, oldest first, ending today. */
  calendar: CalendarDay[];
  now: Date;
}

const lemmaCard = (row: CardRow): LemmaCard => ({
  lemmaIds: [row.targetId],
  schedule: toSchedule(row),
});

/** All review logs before `cutoff`, for replay. */
function logsBefore(repos: Repositories, cutoff: Date): ReplayLog[] {
  const out: ReplayLog[] = [];
  let cursor = null;
  for (;;) {
    const page = repos.reviewLogs.listSince(cursor, 1000);
    for (const log of page.rows) {
      if (log.reviewedAt.getTime() >= cutoff.getTime()) return out;
      out.push(log);
    }
    if (!page.nextCursor) return out;
    cursor = page.nextCursor;
  }
}

/**
 * Compute progress from the database with core's measures: known words
 * (`knownLemmaCount`), CEFR estimate, hours projection (rate measured by
 * replaying review logs to 30 days ago), and the forecast review load.
 */
export function loadProgress(repos: Repositories, now: Date): ProgressData {
  const settings = repos.settings.getAll();
  const scheduler = schedulerFor(settings);
  const content = getContentIndex(repos);
  const rows = repos.cards.listAll();
  const wordCards = rows.filter((r) => r.kind === KNOWN_WORD_KIND);

  const knownWords = knownLemmaCount(wordCards.map(lemmaCard), now);
  const cefr = estimateCefr({
    knownLemmas: knownWords,
    unlockedGrammarIds: [...unlockedGrammar(rows, content)],
  });

  // Known words 30 days ago, by replaying the word cards' logs up to then.
  const cutoff = new Date(now.getTime() - OBSERVATION_DAYS * 86_400_000);
  const wordCardIds = new Set(wordCards.map((c) => c.id));
  const past = rebuildCardStates(
    logsBefore(repos, cutoff).filter((l) => wordCardIds.has(l.cardId)),
    { scheduler },
  );
  const targetById = new Map(wordCards.map((c) => [c.id, c.targetId]));
  const knownBefore = knownLemmaCount(
    [...past].map(([id, schedule]) => ({ lemmaIds: [targetById.get(id) ?? -1], schedule })),
    cutoff,
  );
  const projection = projectHoursToNextLevel({
    knownLemmas: knownWords,
    observedHours: repos.studySessions.totalActiveMinutes({ from: cutoff, to: now }) / 60,
    observedLemmasGained: knownWords - knownBefore,
  });

  const forecast = projectedLoad({
    now,
    days: FORECAST_DAYS,
    scheduler,
    cards: rows
      .filter((r) => !r.suspended && r.kind !== 'recognition' && isShownKind(r.kind))
      .map((r) => ({ kind: r.kind, schedule: toSchedule(r) })),
  });

  const today = deviceLocalDate(now);
  const first = addDays(today, -(CALENDAR_DAYS - 1));
  const minutesByDay = new Map<LocalDate, number>();
  for (const s of repos.studySessions.listBetween(startOfLocalDate(first), now)) {
    const day = deviceLocalDate(s.startedAt);
    minutesByDay.set(day, (minutesByDay.get(day) ?? 0) + s.minutesActive);
  }
  const calendar = Array.from({ length: CALENDAR_DAYS }, (_, i) => {
    const date = addDays(first, i);
    return { date, minutes: minutesByDay.get(date) ?? 0 };
  });

  return {
    knownWords,
    hours: repos.studySessions.totalActiveMinutes() / 60,
    cefr,
    projection,
    load: forecast.days,
    calendar,
    now,
  };
}
