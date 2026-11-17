/**
 * State of the running study session, in a small Zustand store. The store
 * drives `@italia/core`'s session queue and grading and persists each review
 * through the repositories; screens only render its state and call its
 * actions.
 */
import { createStore, type StoreApi } from 'zustand/vanilla';

import {
  currentEntry,
  gradeTyped,
  recordAnswer,
  startSessionQueue,
  type GradeResult,
  type QueueEntry,
  type Rating,
  type SessionQueue,
  type StreakEvent,
  type StreakView,
} from '@italia/core';

import { toSchedule, type CardRow, type GrammarPointRow, type Repositories } from '@/data';
import { NEW_WORD_KIND } from '@/features/study/curriculum';
import { planToday, type StudyPlan } from '@/features/study/planning';
import { resolvePrompt, type Prompt } from '@/features/study/prompts';
import { currentStreak, recordStreakStudy } from '@/features/study/streakService';
import { msToMinutes } from '@/features/study/time';

import { createActiveTimer } from './activeTimer';
import { encodeAnswer } from './answerLog';

/** Activity recorded on a study session when a review session completes. */
export const REVIEW_SESSION_ACTIVITY = 'review_session';

/** Where the session is. */
export type SessionPhase =
  'idle' | 'empty' | 'grammar_intro' | 'prompt' | 'feedback' | 'summary' | 'error';

/** The graded answer awaiting "Continue". */
export interface Feedback {
  /** The rating that will be recorded (core's, or the override). */
  rating: Rating;
  /** The rating core gave. */
  gradedRating: Rating;
  grade: GradeResult;
  answer: string;
  latencyMs: number;
  answeredAt: Date;
  overridden: boolean;
}

/** End-of-session summary. */
export interface SessionSummary {
  /** Answers given, repeats included. */
  answers: number;
  /** Share of first attempts (excluding first exposures) answered correctly, or null. */
  accuracy: number | null;
  newWords: number;
  reviews: number;
  /** Active minutes in this session. */
  minutes: number;
  streak: StreakView;
  streakEvents: StreakEvent[];
}

/** State of the session store. */
export interface SessionState {
  phase: SessionPhase;
  queue: SessionQueue | null;
  entry: QueueEntry | null;
  prompt: Prompt | null;
  /** Grammar point to introduce before the current item. */
  grammarIntro: GrammarPointRow | null;
  feedback: Feedback | null;
  summary: SessionSummary | null;
  error: string | null;
  /** Items in the plan, for progress display. */
  plannedItems: number;
  /** When the current prompt was shown (ms since epoch), for latency. */
  promptShownAt: number;
}

/** Actions on the session store. */
export interface SessionActions {
  /** Plan today's session, create its new cards and show the first item. */
  start: () => void;
  /** Close the grammar note and show the item. */
  dismissGrammarIntro: () => void;
  /** Grade a typed answer and show feedback. */
  submitTyped: (answer: string) => void;
  /** "Got it" on a first exposure: record it and move on. */
  acknowledgeRecognition: () => void;
  /** "I was right": record the answer as Good instead of the wrong grade. */
  overrideCorrect: () => void;
  /** Record the graded answer and move to the next item. */
  continue: () => void;
  /** The app went to the background. */
  pause: () => void;
  /** The app came back to the foreground. */
  resume: () => void;
  /** Leave the session early, saving study time. */
  quit: () => void;
}

export type SessionStore = StoreApi<SessionState & SessionActions>;

/** Dependencies of {@link createSessionStore}. */
export interface SessionDeps {
  repos: Repositories;
  /** Clock; defaults to the system clock. */
  now?: () => Date;
}

const INITIAL: SessionState = {
  phase: 'idle',
  queue: null,
  entry: null,
  prompt: null,
  grammarIntro: null,
  feedback: null,
  summary: null,
  error: null,
  plannedItems: 0,
  promptShownAt: 0,
};

/** Create the store for one study session. */
export function createSessionStore({ repos, now = () => new Date() }: SessionDeps): SessionStore {
  const timer = createActiveTimer();
  const events: StreakEvent[] = [];
  let plan: StudyPlan | null = null;
  let cards = new Map<string, CardRow>();
  let studySessionId: string | null = null;
  let deviceId = '';
  const introducedGrammar = new Set<number>();
  let finished = false;

  return createStore<SessionState & SessionActions>()((set, get) => {
    const fail = (e: unknown) => {
      set({ phase: 'error', error: e instanceof Error ? e.message : String(e) });
    };

    /** Save active time since the last flush to the study session and streak. */
    const flushTime = (completedSession = false) => {
      const at = now();
      const minutes = msToMinutes(timer.take(at.getTime()));
      if (studySessionId !== null && minutes > 0) {
        repos.studySessions.heartbeat(studySessionId, minutes);
      }
      if (minutes > 0 || completedSession) {
        events.push(...recordStreakStudy(repos, { at, activeMinutes: minutes, completedSession }));
      }
    };

    const promptFor = (entry: QueueEntry): Prompt | null => {
      const card = cards.get(entry.item.cardId);
      if (!card || !plan) return null;
      return resolvePrompt(card, plan.content);
    };

    const summarise = (queue: SessionQueue): SessionSummary => {
      const firsts = queue.completed.filter(
        (c) => c.attempt === 1 && c.item.kind !== NEW_WORD_KIND,
      );
      const at = now();
      return {
        answers: queue.completed.length,
        accuracy:
          firsts.length === 0
            ? null
            : firsts.filter((c) => c.rating !== 'again').length / firsts.length,
        newWords: queue.completed.filter((c) => c.item.kind === NEW_WORD_KIND).length,
        reviews: firsts.filter((c) => c.item.source === 'review').length,
        minutes: msToMinutes(timer.totalMs(at.getTime())),
        streak: currentStreak(repos, at),
        streakEvents: [...events],
      };
    };

    const finish = (queue: SessionQueue) => {
      timer.pause(now().getTime());
      flushTime(true);
      if (studySessionId !== null) {
        repos.studySessions.addActivity(studySessionId, REVIEW_SESSION_ACTIVITY);
        repos.studySessions.end(studySessionId, now());
        studySessionId = null;
      }
      finished = true;
      set({ phase: 'summary', summary: summarise(queue), entry: null, prompt: null });
    };

    /** Show the current entry of `queue`, or the summary when it is empty. */
    const show = (queue: SessionQueue) => {
      const entry = currentEntry(queue);
      if (!entry) {
        finish(queue);
        return;
      }
      const prompt = promptFor(entry);
      if (!prompt) throw new Error(`Card content is missing: ${entry.item.cardId}`);
      const newPoint = entry.item.grammarIds.find((id) => !introducedGrammar.has(id));
      const grammarIntro =
        newPoint === undefined ? null : (plan?.content.grammarById.get(newPoint) ?? null);
      set({
        queue,
        entry,
        prompt,
        feedback: null,
        grammarIntro,
        phase: grammarIntro ? 'grammar_intro' : 'prompt',
        promptShownAt: now().getTime(),
      });
    };

    /** Persist a review of the current item and advance the queue. */
    const answer = (rating: Rating, logged: string | null, latencyMs: number, at: Date) => {
      const { queue, entry } = get();
      if (!queue || !entry || !plan) return;
      const card = cards.get(entry.item.cardId);
      if (!card) throw new Error(`Card not found: ${entry.item.cardId}`);
      const result = plan.scheduler.review(toSchedule(card), rating, at);
      repos.recordReview({
        cardId: card.id,
        rating,
        answer: logged,
        latencyMs: Math.max(0, Math.round(latencyMs)),
        reviewedAt: at,
        deviceId,
        next: result.card,
      });
      cards.set(card.id, { ...card, ...result.card });
      flushTime();
      show(recordAnswer(queue, rating));
    };

    return {
      ...INITIAL,

      start() {
        try {
          finished = false;
          const at = now();
          const today = planToday(repos, at);
          plan = today;
          deviceId = repos.meta.getOrCreateDeviceId();
          for (const id of today.curriculum.unlockedGrammarIds) introducedGrammar.add(id);
          const created = repos.cards.createMany([...today.newCards.values()]);
          cards = new Map(today.cards);
          for (const c of created) cards.set(c.id, c);
          const items = today.plan.items.filter((item) => {
            const c = cards.get(item.cardId);
            return c !== undefined && resolvePrompt(c, today.content) !== null;
          });
          if (items.length === 0) {
            set({ ...INITIAL, phase: 'empty' });
            return;
          }
          const stale = repos.studySessions.getActive();
          if (stale) repos.studySessions.end(stale.id, at);
          studySessionId = repos.studySessions.start(at).id;
          timer.resume(at.getTime());
          set({ plannedItems: items.length });
          show(startSessionQueue(items));
        } catch (e) {
          fail(e);
        }
      },

      dismissGrammarIntro() {
        const { grammarIntro } = get();
        if (grammarIntro) introducedGrammar.add(grammarIntro.id);
        set({ grammarIntro: null, phase: 'prompt', promptShownAt: now().getTime() });
      },

      submitTyped(text) {
        const { prompt, entry, phase, promptShownAt } = get();
        if (phase !== 'prompt' || !prompt || !entry || prompt.kind === 'recognition') return;
        try {
          const at = now();
          const latencyMs = Math.max(0, at.getTime() - promptShownAt);
          const { grade, rating } = gradeTyped({
            answer: text,
            accepted: prompt.accepted,
            kind: entry.item.kind,
            latencyMs,
          });
          set({
            phase: 'feedback',
            feedback: {
              rating,
              gradedRating: rating,
              grade,
              answer: text,
              latencyMs,
              answeredAt: at,
              overridden: false,
            },
          });
        } catch (e) {
          fail(e);
        }
      },

      acknowledgeRecognition() {
        const { prompt, phase, promptShownAt } = get();
        if (phase !== 'prompt' || prompt?.kind !== 'recognition') return;
        try {
          const at = now();
          // A first exposure is not a recall test: it is logged as easy so
          // the queue moves on, and recognition cards are never reviewed.
          answer('easy', null, at.getTime() - promptShownAt, at);
        } catch (e) {
          fail(e);
        }
      },

      overrideCorrect() {
        const { feedback } = get();
        if (!feedback || feedback.grade.correct || feedback.overridden) return;
        set({ feedback: { ...feedback, rating: 'good', overridden: true } });
      },

      continue() {
        const { feedback, phase } = get();
        if (phase !== 'feedback' || !feedback) return;
        try {
          const logged = encodeAnswer(
            feedback.overridden
              ? {
                  text: feedback.answer,
                  override: { from: feedback.gradedRating, to: feedback.rating },
                }
              : { text: feedback.answer },
          );
          answer(feedback.rating, logged, feedback.latencyMs, feedback.answeredAt);
        } catch (e) {
          fail(e);
        }
      },

      pause() {
        if (finished || studySessionId === null) return;
        timer.pause(now().getTime());
        try {
          flushTime();
        } catch (e) {
          fail(e);
        }
      },

      resume() {
        if (finished || studySessionId === null) return;
        timer.resume(now().getTime());
      },

      quit() {
        if (finished) return;
        finished = true;
        try {
          timer.pause(now().getTime());
          flushTime();
          if (studySessionId !== null) {
            repos.studySessions.end(studySessionId, now());
            studySessionId = null;
          }
        } catch (e) {
          fail(e);
        }
      },
    };
  });
}
