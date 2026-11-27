/**
 * Today's path for the app: what is due, ready and done, from the database,
 * turned into core's `buildDailyPath` and then into what each step shows and
 * where it leads.
 */
import {
  buildDailyPath,
  daysBetween,
  rotateDaily,
  SCENARIOS,
  scenariosForLevel,
  type Activity,
  type DailyExtra,
  type DailyPath,
  type DailyStep,
  type DailyStepId,
  type NewItemLimitReason,
  type StreakView,
} from '@italia/core';

import { META_KEYS, type Repositories } from '@/data';
import { loadLearnerProfile } from '@/features/converse/learnerProfile';
import { coveragePercent, loadLibrary, type LibraryEpisode } from '@/features/read/library';
import { estimateReadingMinutes } from '@/features/read/storyModel';
import { countSpeakingDrill } from '@/features/speak/drill/drillData';
import { ITEMS_PER_NEW_WORD, NEW_WORD_KIND } from '@/features/study/curriculum';
import { knownWordCount } from '@/features/study/knownWords';
import { itemsForPart, planToday, type SessionPart } from '@/features/study/planning';
import { currentStreak } from '@/features/study/streakService';
import { deviceLocalDate, startOfLocalDay, startOfNextLocalDay } from '@/features/study/time';
import type { TutorModelChoice } from '@/tutor';

/** Ear-training trials in one round of the path's listening step. */
export const EAR_TRAINING_ROUND = 20;
/** Sentences recorded in one round of the path's shadowing step. */
export const SHADOWING_ROUND = 5;

/** Typical minutes for steps whose length the learner sets as they go. */
const STEP_MINUTES = {
  ear_training: 5,
  speaking_drill: 5,
  shadowing: 5,
  conversation: 10,
} as const;

/** Where a step leads: an app route with its params. */
export type StepTarget =
  | { pathname: '/session'; params: { part: SessionPart } }
  | { pathname: '/story/[id]'; params: { id: string } }
  | { pathname: '/speak/ear' }
  | { pathname: '/speak/drill' }
  | { pathname: '/speak/shadow' }
  | { pathname: '/speak/converse' }
  | { pathname: '/speak/converse/[scenario]'; params: { scenario: string } };

/** What a step (or the extra) shows and where it leads. */
export interface StepView {
  /** The path step; null for the extra offered once the path is finished. */
  step: DailyStep | null;
  activity: Activity;
  title: string;
  /** Short line under the title, such as "34 reviews". */
  detail: string;
  /** Why this comes now, for the "Up next" card. */
  why: string;
  /** Estimated minutes, or null when unknown. */
  minutes: number | null;
  /** Label of the button that starts it. */
  action: string;
  target: StepTarget;
}

/** Something that joins the path later, as the screen shows it. */
export interface UnlockView {
  key: string;
  text: string;
  /** A way to unlock it now (the tutor download), if any. */
  action: { label: string; pathname: '/models' } | null;
}

/** Everything the Today screen shows. */
export interface TodayData {
  path: DailyPath;
  /** One view per path step, in order. */
  steps: StepView[];
  next: StepView | null;
  extra: StepView | null;
  unlocks: UnlockView[];
  /** Estimated minutes for the steps still to do. */
  minutesLeft: number;
  /** Why fewer new items were planned, when it matters. */
  notes: string[];
  streak: StreakView;
  /** Active study minutes in the last 7 days. */
  weekMinutes: number;
}

const LIMIT_NOTES: Record<NewItemLimitReason, string | null> = {
  daily_limit: null,
  low_accuracy: 'Fewer new words today: recent accuracy is under 80%, so reviews come first.',
  review_load: 'New words are held back so the coming week of reviews fits your time budget.',
  time_budget: "Today's time budget is full, so some new material waits until tomorrow.",
};

/** Steps skipped today, from device-local metadata. */
export function loadSkippedSteps(repos: Repositories, now: Date): DailyStepId[] {
  try {
    const raw = repos.meta.get(META_KEYS.dailyPathSkips);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { date?: unknown; steps?: unknown };
    if (parsed.date !== deviceLocalDate(now) || !Array.isArray(parsed.steps)) return [];
    return parsed.steps.filter((s): s is DailyStepId => typeof s === 'string');
  } catch {
    return [];
  }
}

/** Skip a step for the rest of today. */
export function skipStep(repos: Repositories, id: DailyStepId, now: Date): void {
  const steps = [...new Set([...loadSkippedSteps(repos, now), id])];
  repos.meta.set(META_KEYS.dailyPathSkips, JSON.stringify({ date: deviceLocalDate(now), steps }));
}

const plural = (n: number, one: string, many = `${one}s`) => `${String(n)} ${n === 1 ? one : many}`;

/** The day as a number that grows by one each local day (for rotating scenarios). */
function dayNumber(now: Date): number {
  return daysBetween('2026-01-01', deviceLocalDate(now));
}

/** Load today's path and everything the Today screen shows. */
export function loadToday(repos: Repositories, now: Date, tutor: TutorModelChoice): TodayData {
  const today = planToday(repos, now);
  const reviews = itemsForPart(today.plan, 'reviews');
  const learn = itemsForPart(today.plan, 'learn');
  const library = loadLibrary(repos, now);
  const activitiesToday = repos.studySessions
    .listBetween(startOfLocalDay(now), startOfNextLocalDay(now))
    .flatMap((s) => s.activities);
  const knownWords = knownWordCount(repos.cards.listAll(), now);
  const spokenPrompts = countSpeakingDrill(today, now);

  const path = buildDailyPath({
    reviewsDue: reviews.length,
    newItemsPlanned: learn.length,
    spokenPromptsReady: spokenPrompts,
    storyReady: library.upNext !== null,
    tutor:
      tutor.state === 'ready'
        ? 'ready'
        : tutor.state === 'needs_download'
          ? 'needs_download'
          : 'unavailable',
    knownWords,
    activitiesToday,
    skippedToday: loadSkippedSteps(repos, now),
  });

  const seconds = (items: readonly { estimatedSeconds: number }[]) =>
    items.reduce((sum, i) => sum + i.estimatedSeconds, 0);
  const minutesOf = (items: readonly { estimatedSeconds: number }[]) =>
    Math.max(1, Math.ceil(seconds(items) / 60));
  const newWords = learn.filter((i) => i.kind === NEW_WORD_KIND).length;
  const practice = learn.length - newWords * ITEMS_PER_NEW_WORD;
  const scenario = rotateDaily(
    scenariosForLevel(SCENARIOS, loadLearnerProfile(repos, now).level),
    dayNumber(now),
  );

  const storyView = (episode: LibraryEpisode, step: DailyStep | null): StepView => ({
    step,
    activity: 'story',
    title: 'Listen and read',
    detail: `${episode.story.title} · ${episode.story.series.titleIt}, episode ${String(episode.seriesIndex)}`,
    why: `Hear the words you are learning in a story. You know ${coveragePercent(episode.coverage.ratio)} of its words. Listen once with the text hidden, then read along.`,
    minutes: estimateReadingMinutes(episode.story.wordCount),
    action: 'Start reading',
    target: { pathname: '/story/[id]', params: { id: episode.id } },
  });

  const view = (activity: Activity, step: DailyStep | null): StepView => {
    switch (activity) {
      case 'review_session':
        return {
          step,
          activity,
          title: 'Warm-up reviews',
          detail: reviews.length > 0 ? plural(reviews.length, 'review') : 'Reviews done',
          why: 'Recall what is due before it slips. Reviews come first, so new words never crowd them out.',
          minutes: reviews.length > 0 ? minutesOf(reviews) : null,
          action: 'Start reviews',
          target: { pathname: '/session', params: { part: 'reviews' } },
        };
      case 'learn_session':
        return {
          step,
          activity,
          title: 'New words and grammar',
          detail:
            learn.length === 0
              ? "Today's new words are done"
              : [
                  newWords > 0 ? plural(newWords, 'new word') : null,
                  practice > 0 ? plural(practice, 'sentence and grammar item') : null,
                ]
                  .filter(Boolean)
                  .join(' · '),
          why: 'The next most common words, each met in a real sentence, with grammar explained as it unlocks.',
          minutes: learn.length > 0 ? minutesOf(learn) : null,
          action: 'Start learning',
          target: { pathname: '/session', params: { part: 'learn' } },
        };
      case 'story': {
        const episode = library.upNext ?? library.closest;
        if (episode) return storyView(episode, step);
        return view('ear_training', step);
      }
      case 'ear_training':
        return {
          step,
          activity,
          title: 'Ear training',
          detail: `${String(EAR_TRAINING_ROUND)} sounds that English doesn't have`,
          why: 'Learn to hear Italian sounds apart, spoken by different voices. It makes listening and your own pronunciation easier.',
          minutes: STEP_MINUTES.ear_training,
          action: 'Start ear training',
          target: { pathname: '/speak/ear' },
        };
      case 'speaking_drill':
        return {
          step,
          activity,
          title: 'Speak',
          detail: `Say ${plural(Math.max(1, spokenPrompts), 'sentence')} out loud`,
          why: 'Hear the English, say it in Italian, then hear the answer. Speaking every day is what turns words you know into words you can use.',
          minutes: STEP_MINUTES.speaking_drill,
          action: 'Start speaking',
          target: { pathname: '/speak/drill' },
        };
      case 'shadowing':
        return {
          step,
          activity,
          title: 'Shadowing',
          detail: `Repeat ${plural(SHADOWING_ROUND, 'short sentence')} after the voice`,
          why: 'Say short sentences straight after the model voice and compare. It trains the rhythm and sounds of Italian from day one.',
          minutes: STEP_MINUTES.shadowing,
          action: 'Start shadowing',
          target: { pathname: '/speak/shadow' },
        };
      case 'conversation':
        return {
          step,
          activity,
          title: 'Conversation',
          detail: scenario ? `${scenario.title} (${scenario.titleEn})` : 'Talk with the tutor',
          why: 'Use what you know in a real exchange with the tutor on this phone. Its corrections become reviews.',
          minutes: STEP_MINUTES.conversation,
          action: 'Start the conversation',
          target: scenario
            ? { pathname: '/speak/converse/[scenario]', params: { scenario: scenario.id } }
            : { pathname: '/speak/converse' },
        };
    }
  };

  const steps = path.steps.map((s) => view(s.activity, s));
  const next = steps.find((s) => s.step?.status === 'current') ?? null;
  const minutesLeft = steps
    .filter((s) => s.step?.status === 'current' || s.step?.status === 'upcoming')
    .reduce((sum, s) => sum + (s.minutes ?? 0), 0);

  const extraActivity: Record<DailyExtra, Activity> = {
    reviews: 'review_session',
    story: 'story',
    speaking_drill: 'speaking_drill',
  };
  const extra = path.extra ? view(extraActivity[path.extra], null) : null;
  if (extra && path.extra === 'reviews') {
    extra.title = 'More reviews are due';
    extra.why = `${plural(reviews.length, 'review has', 'reviews have')} come due since your last session. Doing them now keeps tomorrow light.`;
  }

  const unlocks: UnlockView[] = path.unlocks.flatMap((u): UnlockView[] => {
    if (u.step === 'listen') {
      // No stories installed: nothing to promise.
      const closest = library.closest;
      if (!closest) return [];
      return [
        {
          key: 'story',
          text: `Stories join your path once you know 90% of the words in one. The closest, ${closest.story.title}, is at ${coveragePercent(closest.coverage.ratio)}.`,
          action: null,
        },
      ];
    }
    if (u.waitsFor === 'words') {
      return [
        {
          key: 'conversation',
          text: `Conversation with the tutor joins your path once you know about ${plural(u.wordsNeeded, 'more word')}.`,
          action: null,
        },
      ];
    }
    return [
      {
        key: 'conversation',
        text: 'You know enough words for conversations with the tutor. Download it to add a conversation to your path.',
        action: { label: 'Set up the tutor', pathname: '/models' },
      },
    ];
  });

  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  return {
    path,
    steps,
    next,
    extra,
    unlocks,
    minutesLeft,
    notes: [
      ...today.limitedBy.map((r) => LIMIT_NOTES[r]).filter((n): n is string => n !== null),
      ...(today.plan.deferredReviewCount > 0
        ? [
            `${plural(today.plan.deferredReviewCount, 'more review')} will wait for another session.`,
          ]
        : []),
    ],
    streak: currentStreak(repos, now),
    weekMinutes: repos.studySessions.totalActiveMinutes({ from: weekAgo, to: now }),
  };
}
