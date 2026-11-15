import type { CardKind, CardState } from '@italia/core';

/** Display names of card kinds. */
export const KIND_NAMES: Record<CardKind, string> = {
  recognition: 'First exposure',
  cloze_production: 'Word in context',
  grammar_cloze: 'Grammar',
  sentence_production: 'Translate',
  dictation: 'Dictation',
  spoken_prompt: 'Speaking',
  minimal_pair: 'Ear training',
};

/** Display names of FSRS states. */
export const STATE_NAMES: Record<CardState, string> = {
  new: 'New',
  learning: 'Learning',
  review: 'Review',
  relearning: 'Relearning',
};

const DAY_MS = 86_400_000;

/** When a card is due, relative to `now`: "due now", "due in 3 hours", "due in 5 days". */
export function formatDue(due: Date, now: Date): string {
  const ms = due.getTime() - now.getTime();
  if (ms <= 0) return 'due now';
  const hours = ms / 3_600_000;
  if (hours < 1) return `due in ${String(Math.max(1, Math.round(ms / 60_000)))} min`;
  if (hours < 24) return `due in ${String(Math.round(hours))} h`;
  const days = Math.round(ms / DAY_MS);
  return days === 1 ? 'due tomorrow' : `due in ${String(days)} days`;
}

/** A duration in days, rounded sensibly: "0.4 days", "12 days". */
export function formatDays(days: number): string {
  const rounded = days < 10 ? Math.round(days * 10) / 10 : Math.round(days);
  return `${String(rounded)} ${rounded === 1 ? 'day' : 'days'}`;
}

/** A share as a whole percentage. */
export const percent = (x: number) => `${String(Math.round(x * 100))}%`;
