import { addDays, type LocalDate, type LocalDateFn, type StreakConfig } from '@italia/core';

const pad = (n: number) => String(n).padStart(2, '0');

/** The device's local calendar date for an instant, as YYYY-MM-DD. */
export const deviceLocalDate: LocalDateFn = (instant) =>
  `${String(instant.getFullYear())}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())}`;

/** Local midnight at the start of `date` (a YYYY-MM-DD local date). */
export function startOfLocalDate(date: LocalDate): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** Local midnight at the start of the day containing `now`. */
export function startOfLocalDay(now: Date): Date {
  return startOfLocalDate(deviceLocalDate(now));
}

/** Local midnight at the start of the next day after `now`'s. */
export function startOfNextLocalDay(now: Date): Date {
  return startOfLocalDate(addDays(deviceLocalDate(now), 1));
}

/** Streak rules for the app: core defaults, on the device's calendar. */
export const STREAK_CONFIG: StreakConfig = { localDate: deviceLocalDate };

/** Milliseconds to minutes. */
export const msToMinutes = (ms: number) => ms / 60_000;
