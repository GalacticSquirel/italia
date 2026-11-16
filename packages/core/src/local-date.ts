/** A calendar date in the learner's time zone, formatted `YYYY-MM-DD`. */
export type LocalDate = string;

/** Maps an instant to the learner's local calendar date. */
export type LocalDateFn = (instant: Date) => LocalDate;

const MS_PER_DAY = 86_400_000;
const PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;

function toUtcMs(date: LocalDate): number {
  const match = PATTERN.exec(date);
  if (match === null) {
    throw new RangeError(`not a YYYY-MM-DD date: ${date}`);
  }
  const [, y, m, d] = match;
  const ms = Date.UTC(Number(y), Number(m) - 1, Number(d));
  if (new Date(ms).toISOString().slice(0, 10) !== date) {
    throw new RangeError(`not a valid calendar date: ${date}`);
  }
  return ms;
}

/**
 * Add `days` (which may be negative) to a local date.
 *
 * @throws RangeError when `date` is not a valid `YYYY-MM-DD` date
 */
export function addDays(date: LocalDate, days: number): LocalDate {
  return new Date(toUtcMs(date) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * Whole calendar days from `from` to `to` (positive when `to` is later).
 *
 * @throws RangeError when either date is not a valid `YYYY-MM-DD` date
 */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}

/**
 * A {@link LocalDateFn} for an IANA time zone such as `Europe/Rome`, using
 * `Intl.DateTimeFormat`. The app can pass its own function instead (for
 * example from the device's calendar settings).
 */
export function localDateInTimeZone(timeZone: string): LocalDateFn {
  const format = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return (instant) => {
    const parts = format.formatToParts(instant);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  };
}
