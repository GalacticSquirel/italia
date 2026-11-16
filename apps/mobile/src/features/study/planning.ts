import {
  buildSession,
  createScheduler,
  type NewItemLimitReason,
  type Scheduler,
  type SessionCard,
  type SessionPlan,
} from '@italia/core';

import {
  toSchedule,
  type CardRow,
  type NewCardInput,
  type Repositories,
  type Settings,
} from '@/data';

import { getContentIndex, type ContentIndex } from './content';
import {
  buildCurriculum,
  ITEMS_PER_NEW_WORD,
  NEW_WORD_KIND,
  PRACTICE_ITEMS_PER_NEW_WORD,
  type Curriculum,
  type CurriculumCandidate,
} from './curriculum';
import { cardGrammarIds, cardLemmaIds, isPhase1Kind, resolvePrompt } from './prompts';
import { startOfLocalDay, startOfNextLocalDay } from './time';

/** Reviews used to measure recent accuracy. */
const RECENT_REVIEWS = 50;
/** Fewer recent reviews than this give no accuracy signal. */
const MIN_REVIEWS_FOR_ACCURACY = 10;

/** Today's study plan and what went into it. */
export interface StudyPlan {
  plan: SessionPlan;
  /** New words in the plan (first exposures). */
  newWords: number;
  /** New words that could still be introduced on later days. */
  wordsAvailable: number;
  /** Planned new items, keyed by card id, to create when the session starts. */
  newCards: Map<string, NewCardInput>;
  /** Cards with their current FSRS state, keyed by id (planned reviews and every known card). */
  cards: Map<string, CardRow>;
  scheduler: Scheduler;
  settings: Settings;
  content: ContentIndex;
  curriculum: Curriculum;
  /** Why fewer new items were planned than the limit allows. */
  limitedBy: NewItemLimitReason[];
}

/** A card row as `buildSession` expects it. */
function toSessionCard(row: CardRow, content: ContentIndex): SessionCard {
  return {
    id: row.id,
    kind: row.kind,
    schedule: toSchedule(row),
    lemmaIds: cardLemmaIds(row, content),
    grammarIds: cardGrammarIds(row, content),
  };
}

/** Share of recent reviews not rated `again`, or null without enough history. */
export function recentAccuracy(repos: Repositories): number | null {
  const recent = repos.reviewLogs.listRecent(RECENT_REVIEWS, { excludeKinds: [NEW_WORD_KIND] });
  if (recent.length < MIN_REVIEWS_FOR_ACCURACY) return null;
  return recent.filter((r) => r.rating !== 'again').length / recent.length;
}

/** The scheduler configured by the learner's settings. */
export function schedulerFor(settings: Settings): Scheduler {
  return createScheduler({ desiredRetention: settings.desiredRetention });
}

/**
 * Plan today's session from the database: the learner's cards (reviews), the
 * curriculum (new items) and settings, through `buildSession` in core.
 *
 * Cards whose content is missing or whose kind is not shown yet are left out,
 * as are recognition cards, which are first exposures only and never reviewed.
 */
export function planToday(repos: Repositories, now: Date): StudyPlan {
  const settings = repos.settings.getAll();
  const scheduler = schedulerFor(settings);
  const content = getContentIndex(repos);
  const rows = repos.cards.listAll();

  const reviewable = rows.filter(
    (r) =>
      !r.suspended &&
      r.kind !== NEW_WORD_KIND &&
      isPhase1Kind(r.kind) &&
      resolvePrompt(r, content) !== null,
  );

  const dayStart = startOfLocalDay(now);
  const dayEnd = startOfNextLocalDay(now);
  const wordsToday = repos.reviewLogs.countCardsFirstReviewedBetween(dayStart, dayEnd, {
    kinds: [NEW_WORD_KIND],
  });
  const itemsToday = repos.reviewLogs.countCardsFirstReviewedBetween(dayStart, dayEnd);
  const practiceToday = itemsToday - wordsToday * ITEMS_PER_NEW_WORD;
  const practiceLimit = Math.ceil(settings.dailyNewLimit * PRACTICE_ITEMS_PER_NEW_WORD);

  const curriculum = buildCurriculum(content, rows, {
    words: Math.max(0, settings.dailyNewLimit - wordsToday),
    practice: Math.max(0, practiceLimit - Math.max(0, practiceToday)),
  });

  const plan = buildSession({
    now,
    cards: reviewable.map((r) => toSessionCard(r, content)),
    newCandidates: curriculum.candidates,
    settings: {
      dailyNewLimit: settings.dailyNewLimit * ITEMS_PER_NEW_WORD + practiceLimit,
      minutesBudget: settings.minutesBudget,
      recentAccuracy: recentAccuracy(repos),
      alreadyIntroducedToday: itemsToday,
    },
    seed: Math.floor(now.getTime() / 86_400_000),
    tuning: { scheduler },
  });

  const byId = new Map<string, CurriculumCandidate>(curriculum.candidates.map((c) => [c.id, c]));
  const newCards = new Map<string, NewCardInput>();
  let newWords = 0;
  for (const item of plan.items) {
    if (item.source !== 'new') continue;
    const c = byId.get(item.cardId);
    if (!c) continue;
    if (c.newWord) newWords += 1;
    newCards.set(c.id, {
      kind: c.kind,
      targetId: c.targetId,
      promptMode: 'typed',
      schedule: scheduler.newCard(now),
      createdAt: now,
    });
  }

  return {
    plan,
    newWords,
    wordsAvailable: curriculum.wordsAvailable,
    newCards,
    cards: new Map(rows.map((r) => [r.id, r])),
    scheduler,
    settings,
    content,
    curriculum,
    limitedBy: plan.newItems.limitedBy,
  };
}
