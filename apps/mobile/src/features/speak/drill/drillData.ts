/**
 * Spoken prompts for the Speak tab's drill: today's due spoken reviews, then
 * today's new spoken prompts (the same ones the study session's speaking
 * block would introduce), and recording their reviews.
 */
import { toSchedule, type CardRow, type Repositories } from '@/data';
import { encodeAnswer } from '@/features/session/answerLog';
import { planToday, type StudyPlan } from '@/features/study/planning';
import { resolvePrompt } from '@/features/study/prompts';

import type { DrillItem, DrillOutcome } from './drillMachine';

/** Most items in one drill. */
export const DRILL_LENGTH = 10;

/** A loaded drill. */
export interface SpeakingDrill {
  items: DrillItem[];
  /** Records a graded item. */
  record(outcome: DrillOutcome, at: Date): void;
}

/** Load due and new spoken prompts, creating today's new spoken cards. */
export function loadSpeakingDrill(
  repos: Repositories,
  at: Date,
  limit = DRILL_LENGTH,
): SpeakingDrill {
  const plan: StudyPlan = planToday(repos, at);
  const cards = new Map<string, CardRow>();
  const due = [...plan.cards.values()]
    .filter(
      (c) =>
        c.kind === 'spoken_prompt' &&
        !c.suspended &&
        c.state !== 'new' &&
        c.due.getTime() <= at.getTime(),
    )
    .sort((a, b) => a.due.getTime() - b.due.getTime());
  for (const c of due) cards.set(c.id, c);
  const fresh = [...plan.newCards.values()].filter((c) => c.kind === 'spoken_prompt');
  const room = Math.max(0, limit - due.length);
  for (const c of repos.cards.createMany(fresh.slice(0, room))) cards.set(c.id, c);

  const items: DrillItem[] = [];
  for (const card of cards.values()) {
    if (items.length >= limit) break;
    const prompt = resolvePrompt(card, plan.content);
    if (prompt?.kind !== 'spoken_prompt') continue;
    items.push({
      cardId: card.id,
      cue: prompt.sentence.en,
      answer: prompt.sentence.it,
      accepted: prompt.accepted,
    });
  }
  const deviceId = repos.meta.getOrCreateDeviceId();
  return {
    items,
    record(outcome, when) {
      const card = cards.get(outcome.cardId);
      if (!card) return;
      const result = plan.scheduler.review(toSchedule(card), outcome.rating, when);
      repos.recordReview({
        cardId: card.id,
        rating: outcome.rating,
        answer: encodeAnswer({ text: outcome.transcript }),
        latencyMs: Math.max(0, Math.round(outcome.latencyMs)),
        reviewedAt: when,
        deviceId,
        next: result.card,
      });
      cards.set(card.id, { ...card, ...result.card });
    },
  };
}
