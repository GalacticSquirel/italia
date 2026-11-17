/**
 * Pimsleur-style prompt, pause, answer drill as a pure state machine:
 *
 *     ready → cue → listening → transcribing ─┬→ answer → feedback → (next) cue … → done
 *                      ↑                       └→ retry (first miss) ┘
 *
 * - **cue**: the English cue is spoken (and shown).
 * - **listening**: the pause in which the learner says the Italian; the app
 *   records until they stop speaking or tap Done.
 * - **transcribing**: speech to text; the transcript is graded with
 *   `gradeSpoken` from `@italia/core`.
 * - **retry**: on a first miss the learner is prompted to try once more
 *   (prompt before recast); the rating stays the first attempt's.
 * - **answer**: the model answer is played (the recast).
 * - **feedback**: verdict, transcript and the separate pronunciation score.
 *
 * Side effects (speaking, recording, recognition) live in `useDrillRunner`,
 * which sends the events below.
 */
import {
  gradeSpoken,
  type GradedSpokenResponse,
  type PronunciationScore,
  type Rating,
} from '@italia/core';

/** One drill item. */
export interface DrillItem {
  cardId: string;
  /** English cue. */
  cue: string;
  /** Italian model answer. */
  answer: string;
  accepted: readonly string[];
}

/** Where the drill is. */
export type DrillPhase =
  'ready' | 'cue' | 'listening' | 'transcribing' | 'retry' | 'answer' | 'feedback' | 'done';

/** One graded attempt. */
export interface DrillAttempt {
  transcript: string;
  latencyMs: number;
  graded: GradedSpokenResponse;
}

/** What happened on an item, for recording the review. */
export interface DrillOutcome {
  cardId: string;
  /** Rating from the first attempt (a retry never improves it). */
  rating: Rating;
  /** Transcript of the first attempt. */
  transcript: string;
  latencyMs: number;
  /** Whether the last attempt was right. */
  correctInTheEnd: boolean;
}

/** Drill state. */
export interface DrillState {
  phase: DrillPhase;
  items: readonly DrillItem[];
  index: number;
  attempt: 1 | 2;
  first: DrillAttempt | null;
  last: DrillAttempt | null;
  /** Pronunciation score of the last attempt, when the scorer is available. */
  pronunciation: PronunciationScore | null;
  /** A recognition error to show while listening again. */
  error: string | null;
  outcomes: DrillOutcome[];
  /** Items skipped without an answer. */
  skipped: number;
  allowRetry: boolean;
}

/** Events the runner and the screen send. */
export type DrillEvent =
  | { type: 'start' }
  | { type: 'cueDone' }
  | ({ type: 'recorded' } & AttemptRef)
  | ({ type: 'transcribed'; transcript: string; latencyMs: number } & AttemptRef)
  | ({ type: 'failed'; message: string } & AttemptRef)
  | { type: 'retryDone' }
  | { type: 'scored'; score: PronunciationScore; attempt: 1 | 2; index: number }
  | { type: 'answerDone' }
  | { type: 'next' }
  | { type: 'skip' };

/** A fresh drill. */
/**
 * The item and attempt an asynchronous result belongs to. Recording and
 * speech recognition finish after a delay; a result for an item the learner
 * already skipped must not be graded against the item now showing.
 */
export interface AttemptRef {
  index?: number;
  attempt?: 1 | 2;
}

function isStale(state: DrillState, ref: AttemptRef): boolean {
  return (
    (ref.index !== undefined && ref.index !== state.index) ||
    (ref.attempt !== undefined && ref.attempt !== state.attempt)
  );
}

export function createDrill(
  items: readonly DrillItem[],
  options: { allowRetry?: boolean } = {},
): DrillState {
  return {
    phase: items.length === 0 ? 'done' : 'ready',
    items,
    index: 0,
    attempt: 1,
    first: null,
    last: null,
    pronunciation: null,
    error: null,
    outcomes: [],
    skipped: 0,
    allowRetry: options.allowRetry ?? true,
  };
}

/** The current item, or null when done. */
export function currentItem(state: DrillState): DrillItem | null {
  return state.phase === 'done' ? null : (state.items[state.index] ?? null);
}

function advance(state: DrillState, skipped: boolean): DrillState {
  const index = state.index + 1;
  return {
    ...state,
    phase: index >= state.items.length ? 'done' : 'cue',
    index,
    attempt: 1,
    first: null,
    last: null,
    pronunciation: null,
    error: null,
    skipped: state.skipped + (skipped ? 1 : 0),
  };
}

/** Apply an event; events that do not fit the current phase are ignored. */
export function drillReducer(state: DrillState, event: DrillEvent): DrillState {
  const item = currentItem(state);
  if (
    (event.type === 'recorded' || event.type === 'transcribed' || event.type === 'failed') &&
    isStale(state, event)
  ) {
    return state;
  }
  switch (event.type) {
    case 'start':
      return state.phase === 'ready' ? { ...state, phase: 'cue' } : state;
    case 'cueDone':
      return state.phase === 'cue' ? { ...state, phase: 'listening' } : state;
    case 'recorded':
      return state.phase === 'listening' ? { ...state, phase: 'transcribing', error: null } : state;
    case 'failed':
      return state.phase === 'transcribing' || state.phase === 'listening'
        ? { ...state, phase: 'listening', error: event.message }
        : state;
    case 'transcribed': {
      if (state.phase !== 'transcribing' || !item) return state;
      const graded = gradeSpoken({
        transcript: event.transcript,
        accepted: item.accepted,
        kind: 'spoken_prompt',
        latencyMs: event.latencyMs,
      });
      const attempt: DrillAttempt = {
        transcript: event.transcript,
        latencyMs: event.latencyMs,
        graded,
      };
      if (!graded.grade.correct && state.attempt === 1 && state.allowRetry) {
        return { ...state, phase: 'retry', attempt: 2, first: attempt, last: attempt };
      }
      const first = state.first ?? attempt;
      return {
        ...state,
        phase: 'answer',
        first,
        last: attempt,
        outcomes: [
          ...state.outcomes,
          {
            cardId: item.cardId,
            rating: first.graded.rating,
            transcript: first.transcript,
            latencyMs: first.latencyMs,
            correctInTheEnd: graded.grade.correct,
          },
        ],
      };
    }
    case 'retryDone':
      return state.phase === 'retry' ? { ...state, phase: 'listening' } : state;
    case 'scored':
      return event.index === state.index && event.attempt === state.attempt
        ? { ...state, pronunciation: event.score }
        : state;
    case 'answerDone':
      return state.phase === 'answer' ? { ...state, phase: 'feedback' } : state;
    case 'next':
      return state.phase === 'feedback' ? advance(state, false) : state;
    case 'skip':
      return state.phase === 'done' || state.phase === 'answer' || state.phase === 'feedback'
        ? state
        : advance(state, true);
  }
}

/** The outcome of the current item, once it has been graded. */
export function currentOutcome(state: DrillState): DrillOutcome | null {
  const item = currentItem(state);
  if (!item || (state.phase !== 'answer' && state.phase !== 'feedback')) return null;
  const last = state.outcomes.at(-1);
  return last?.cardId === item.cardId ? last : null;
}
