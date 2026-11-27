/**
 * The daily path: the ordered steps of a study day, so the app can always say
 * what to do next instead of leaving the learner to choose between features.
 *
 * The order follows the research behind the app: retrieval of due reviews
 * first, then new words and grammar, then comprehensible input that reuses
 * them (a story, or ear training before any story fits), then speaking, then
 * a conversation with the tutor once there are enough words to hold one.
 */

/** Activities recorded on a study session when a unit of practice finishes. */
export const ACTIVITIES = {
  /** A review session (due reviews) was finished. */
  reviews: 'review_session',
  /** A learning session (new words and grammar) was finished. */
  learn: 'learn_session',
  story: 'story',
  earTraining: 'ear_training',
  speakingDrill: 'speaking_drill',
  shadowing: 'shadowing',
  conversation: 'conversation',
} as const;

/** An activity id recorded on a study session. */
export type Activity = (typeof ACTIVITIES)[keyof typeof ACTIVITIES];

/** Known words from which the tutor conversation joins the path. */
export const CONVERSATION_MIN_WORDS = 150;

/** The steps of a day, in order. */
export const DAILY_STEP_IDS = ['reviews', 'learn', 'listen', 'speak', 'converse'] as const;

/** One step of the day. */
export type DailyStepId = (typeof DAILY_STEP_IDS)[number];

/** Where a step stands. */
export type DailyStepStatus = 'done' | 'skipped' | 'current' | 'upcoming';

/** One step of the daily path and the activity that fills it today. */
export interface DailyStep {
  id: DailyStepId;
  activity: Activity;
  status: DailyStepStatus;
}

/** Something that will join the path later, and what it waits for. */
export type DailyUnlock =
  | { step: 'listen'; activity: 'story'; waitsFor: 'words' }
  | { step: 'converse'; activity: 'conversation'; waitsFor: 'words'; wordsNeeded: number }
  | { step: 'converse'; activity: 'conversation'; waitsFor: 'download' };

/** What the learner can do once every step is finished. */
export type DailyExtra = 'reviews' | 'story' | 'speaking_drill';

/** What the app knows about today, as input to {@link buildDailyPath}. */
export interface DailyPathInput {
  /** Reviews due now (spoken prompts excluded: they belong to the speaking step). */
  reviewsDue: number;
  /** New words and grammar items that today's plan would still introduce. */
  newItemsPlanned: number;
  /** Spoken prompts ready for the speaking drill (due or new). */
  spokenPromptsReady: number;
  /** A story episode fits the learner's vocabulary. */
  storyReady: boolean;
  /** The tutor model: installed, downloadable, or not usable on this phone. */
  tutor: 'ready' | 'needs_download' | 'unavailable';
  /** Words the learner knows. */
  knownWords: number;
  /** Activities finished today (repeats allowed, any order). */
  activitiesToday: readonly string[];
  /** Steps the learner chose to skip today. */
  skippedToday: readonly DailyStepId[];
}

/** Today's path. */
export interface DailyPath {
  /** The steps in order; steps that do not apply today are left out. */
  steps: DailyStep[];
  /** The step to do now, or null when every step is done or skipped. */
  next: DailyStep | null;
  /** Steps done or skipped. */
  finished: number;
  /** What will join the path later. */
  unlocks: DailyUnlock[];
  /** Once the path is finished: the best use of extra time, or null. */
  extra: DailyExtra | null;
}

/** Which activity fills each step today, or null when the step does not apply. */
function activityFor(id: DailyStepId, input: DailyPathInput, did: Set<string>): Activity | null {
  switch (id) {
    case 'reviews':
      // Reviews that come due after the day's learning (its short learning
      // steps) are no reason to start the path again: they are the extra.
      if (did.has(ACTIVITIES.reviews)) return ACTIVITIES.reviews;
      return input.reviewsDue > 0 && !did.has(ACTIVITIES.learn) ? ACTIVITIES.reviews : null;
    case 'learn':
      return input.newItemsPlanned > 0 || did.has(ACTIVITIES.learn) ? ACTIVITIES.learn : null;
    case 'listen':
      // Ear training stands in until the first story fits; once one was done
      // today the step keeps it, so a finished step never comes undone.
      if (did.has(ACTIVITIES.earTraining) && !did.has(ACTIVITIES.story)) {
        return ACTIVITIES.earTraining;
      }
      return input.storyReady ? ACTIVITIES.story : ACTIVITIES.earTraining;
    case 'speak':
      if (did.has(ACTIVITIES.shadowing) && !did.has(ACTIVITIES.speakingDrill)) {
        return ACTIVITIES.shadowing;
      }
      return input.spokenPromptsReady > 0 || did.has(ACTIVITIES.speakingDrill)
        ? ACTIVITIES.speakingDrill
        : ACTIVITIES.shadowing;
    case 'converse':
      return input.tutor === 'ready' && input.knownWords >= CONVERSATION_MIN_WORDS
        ? ACTIVITIES.conversation
        : null;
  }
}

/** A step is done once its activity was finished today (or, for study, nothing is left). */
function isDone(id: DailyStepId, activity: Activity, input: DailyPathInput, did: Set<string>) {
  if (id === 'reviews') return did.has(activity) || input.reviewsDue === 0;
  if (id === 'learn') return did.has(activity) || input.newItemsPlanned === 0;
  return did.has(activity);
}

/**
 * Build today's path from what is due, what is ready and what was done.
 *
 * Steps are taken in a fixed order and the first unfinished one is `next`.
 * Reviews that come due later in the day (new cards' short learning steps)
 * neither reopen a finished review step nor add one after the day's learning:
 * they would pull the learner back after every activity. They are offered as
 * the `extra` once the path is finished.
 */
export function buildDailyPath(input: DailyPathInput): DailyPath {
  const did = new Set(input.activitiesToday);
  const skipped = new Set(input.skippedToday);
  const steps: DailyStep[] = [];
  let next: DailyStep | null = null;
  for (const id of DAILY_STEP_IDS) {
    const activity = activityFor(id, input, did);
    if (activity === null) continue;
    let status: DailyStepStatus;
    if (isDone(id, activity, input, did)) status = 'done';
    else if (skipped.has(id)) status = 'skipped';
    else if (next === null) status = 'current';
    else status = 'upcoming';
    const step = { id, activity, status };
    if (status === 'current') next = step;
    steps.push(step);
  }

  const unlocks: DailyUnlock[] = [];
  if (!input.storyReady && !did.has(ACTIVITIES.story)) {
    unlocks.push({ step: 'listen', activity: 'story', waitsFor: 'words' });
  }
  if (!steps.some((s) => s.id === 'converse') && input.tutor !== 'unavailable') {
    unlocks.push(
      input.knownWords < CONVERSATION_MIN_WORDS
        ? {
            step: 'converse',
            activity: 'conversation',
            waitsFor: 'words',
            wordsNeeded: CONVERSATION_MIN_WORDS - input.knownWords,
          }
        : { step: 'converse', activity: 'conversation', waitsFor: 'download' },
    );
  }

  let extra: DailyExtra | null = null;
  if (next === null) {
    if (input.reviewsDue > 0) extra = 'reviews';
    else if (input.storyReady) extra = 'story';
    else if (input.spokenPromptsReady > 0) extra = 'speaking_drill';
  }

  return {
    steps,
    next,
    finished: steps.filter((s) => s.status === 'done' || s.status === 'skipped').length,
    unlocks,
    extra,
  };
}

/**
 * The item for a day when the path rotates through a list (for example the
 * conversation scenario at the learner's level), so each comes up in turn.
 *
 * @param dayNumber - any whole number that grows by one each local day
 */
export function rotateDaily<T>(items: readonly T[], dayNumber: number): T | null {
  if (items.length === 0) return null;
  const n = items.length;
  return items[((Math.trunc(dayNumber) % n) + n) % n] ?? null;
}
