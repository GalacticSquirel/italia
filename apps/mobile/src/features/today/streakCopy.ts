import type { StreakView } from '@italia/core';

const plural = (n: number, one: string, many = `${one}s`) => `${String(n)} ${n === 1 ? one : many}`;

/** Days as "1 day" or "N days". */
export const days = (n: number) => plural(n, 'day');

/** A short, forgiving sentence about the streak's status. */
export function streakMessage(streak: StreakView): string {
  switch (streak.status) {
    case 'none':
      return 'Study for 10 minutes or finish a session to start a streak.';
    case 'active':
      return 'Today counts. See you tomorrow.';
    case 'due_today':
      return `Study today to make it ${days(streak.currentDays + 1)}.`;
    case 'frozen':
      return 'You missed a day, but a saved freeze will cover it when you study today.';
    case 'repairable':
      return streak.repair
        ? `Do a double session by ${streak.repair.expiresOn} to repair your ${days(streak.repair.lostDays)} streak.`
        : 'Study today to start a new streak.';
    case 'broken':
      return 'Fresh start: every session counts, and everything you learned is still here.';
  }
}

/** "N freezes saved" or null with none. */
export function freezesText(n: number): string | null {
  return n === 0 ? null : `${plural(n, 'freeze')} saved`;
}
