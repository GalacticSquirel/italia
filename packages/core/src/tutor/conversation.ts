/**
 * A tutor conversation as a pure state machine, plus the async step that asks
 * a {@link ConversationPartner} for the next tutor turn and checks it.
 *
 * Phases:
 *
 * ```
 * idle --start--> thinking --token--> streaming --reply--> learner_turn
 *                    ^                                        |
 *                    +-------------- learner (send) ----------+
 * thinking/streaming --failed--> failed --retry--> thinking
 * thinking/streaming --aborted--> learner_turn (the sent text comes back as a draft)
 * any --end--> ended
 * ```
 */
import type {
  AbortSignalLike,
  ConversationPartner,
  ConversationReplyResult,
  ConversationTurn,
} from '../providers';
import type { NewWord, TutorContext, TutorOutput, TutorRecast, TutorTurn } from './types';
import { postValidate } from './validate';

/** Where the conversation is. */
export type ConversationPhase =
  'idle' | 'thinking' | 'streaming' | 'learner_turn' | 'failed' | 'ended';

/** State of one conversation. */
export interface ConversationState {
  phase: ConversationPhase;
  /** Completed turns, tutor first, alternating. */
  turns: readonly TutorTurn[];
  /** The tutor reply decoded so far while streaming. */
  streaming: string;
  /** Goals completed so far, in scenario order. */
  goalsCompleted: readonly string[];
  /** The tutor has said the scenario is finished. */
  scenarioDone: boolean;
  /** Annotations dropped by the checks, by tutor turn index (for diagnostics). */
  dropped: readonly (readonly string[])[];
  /** Text to put back in the input after an aborted turn. */
  draft: string;
  error: string | null;
}

/** Something that happened. */
export type ConversationEvent =
  | { type: 'start' }
  | { type: 'token'; text: string }
  | { type: 'reply'; output: TutorOutput; dropped: readonly string[] }
  | { type: 'failed'; error: string }
  | { type: 'retry' }
  | { type: 'learner'; text: string }
  | { type: 'aborted' }
  | { type: 'end' };

/** A conversation that has not started. */
export const INITIAL_CONVERSATION: ConversationState = {
  phase: 'idle',
  turns: [],
  streaming: '',
  goalsCompleted: [],
  scenarioDone: false,
  dropped: [],
  draft: '',
  error: null,
};

/** Most learner turns in one conversation; the context window and attention set the limit. */
export const MAX_LEARNER_TURNS = 24;

const generating = (s: ConversationState) => s.phase === 'thinking' || s.phase === 'streaming';

/** Learner turns so far. */
export function learnerTurnCount(state: ConversationState): number {
  return state.turns.filter((t) => t.role === 'learner').length;
}

/** Whether the learner may send a message now. */
export function canSend(state: ConversationState): boolean {
  return state.phase === 'learner_turn' && learnerTurnCount(state) < MAX_LEARNER_TURNS;
}

/** Apply one event. Events that do not fit the phase leave the state unchanged. */
export function conversationReducer(
  state: ConversationState,
  event: ConversationEvent,
): ConversationState {
  switch (event.type) {
    case 'start':
      return state.phase === 'idle' ? { ...state, phase: 'thinking', error: null } : state;
    case 'token':
      return generating(state) ? { ...state, phase: 'streaming', streaming: event.text } : state;
    case 'reply': {
      if (!generating(state)) return state;
      const turn: TutorTurn = { role: 'tutor', text: event.output.reply, output: event.output };
      return {
        ...state,
        phase: 'learner_turn',
        turns: [...state.turns, turn],
        streaming: '',
        goalsCompleted: event.output.annotations.scenarioProgress.goalsCompleted,
        scenarioDone: state.scenarioDone || event.output.annotations.scenarioProgress.done,
        dropped: [...state.dropped, event.dropped],
        error: null,
      };
    }
    case 'failed':
      return generating(state)
        ? { ...state, phase: 'failed', streaming: '', error: event.error }
        : state;
    case 'retry':
      return state.phase === 'failed' ? { ...state, phase: 'thinking', error: null } : state;
    case 'learner': {
      const text = event.text.trim();
      if (!canSend(state) || text.length === 0) return state;
      return {
        ...state,
        phase: 'thinking',
        turns: [...state.turns, { role: 'learner', text }],
        draft: '',
      };
    }
    case 'aborted': {
      if (!generating(state)) return state;
      const last = state.turns.at(-1);
      if (last?.role !== 'learner') return { ...state, phase: 'idle', streaming: '' };
      return {
        ...state,
        phase: 'learner_turn',
        turns: state.turns.slice(0, -1),
        streaming: '',
        draft: last.text,
      };
    }
    case 'end':
      return { ...state, phase: 'ended', streaming: '' };
  }
}

/** The learner message the next tutor turn answers, or null before the first. */
export function lastLearnerText(turns: readonly TutorTurn[]): string | null {
  const last = turns.at(-1);
  return last?.role === 'learner' ? last.text : null;
}

/** Turns as provider history (tutor turns keep their structured output). */
export function toConversationHistory(turns: readonly TutorTurn[]): ConversationTurn[] {
  return turns.map((t) =>
    t.role === 'tutor'
      ? { role: 'partner', text: t.text, output: t.output }
      : { role: 'learner', text: t.text },
  );
}

/**
 * Provider history back to tutor turns.
 *
 * @throws Error when a partner turn has no structured output
 */
export function fromConversationHistory(history: readonly ConversationTurn[]): TutorTurn[] {
  return history.map((t) => {
    if (t.role === 'learner') return { role: 'learner', text: t.text };
    if (!t.output) throw new Error('partner turns need their structured output');
    return { role: 'tutor', text: t.output.reply, output: t.output };
  });
}

/** Outcome of {@link requestTutorTurn}. */
export type TutorTurnOutcome =
  | { kind: 'reply'; output: TutorOutput; dropped: string[] }
  | { kind: 'aborted' }
  | { kind: 'failed'; error: string };

/**
 * Ask the partner for the next tutor turn: stream the reply text through
 * `onText` (the whole reply so far), then check the structured output with
 * {@link postValidate}. Never throws; failures come back as `failed`.
 */
export async function requestTutorTurn(
  partner: ConversationPartner,
  context: TutorContext,
  state: Pick<ConversationState, 'turns' | 'goalsCompleted'>,
  options: { signal?: AbortSignalLike; onText?: (text: string) => void } = {},
): Promise<TutorTurnOutcome> {
  let result: ConversationReplyResult;
  try {
    const reply = partner.reply(
      {
        level: context.learner.level,
        scenario: context.scenario.title,
        history: toConversationHistory(state.turns),
        tutor: context,
      },
      options.signal ? { signal: options.signal } : {},
    );
    let text = '';
    for await (const token of reply.tokens) {
      text += token;
      options.onText?.(text);
    }
    result = await reply.result;
  } catch (e) {
    if (options.signal?.aborted === true) return { kind: 'aborted' };
    return { kind: 'failed', error: e instanceof Error ? e.message : String(e) };
  }
  if (result.finishReason === 'aborted') return { kind: 'aborted' };
  if (!result.output) {
    return {
      kind: 'failed',
      error:
        result.finishReason === 'length'
          ? 'The reply was cut off before it finished.'
          : 'The reply could not be read.',
    };
  }
  const checked = postValidate(result.output, {
    context,
    learnerText: lastLearnerText(state.turns),
    previousGoals: state.goalsCompleted,
  });
  return { kind: 'reply', output: checked.output, dropped: checked.dropped };
}

/** A correction made during the conversation. */
export interface Correction {
  /** The learner's whole message. */
  learnerMessage: string;
  kind: 'prompt' | 'recast';
  learnerText: string;
  /** Present for recasts. */
  correctedText: string | null;
  errorTags: readonly string[];
}

/** What the end-of-conversation summary shows. */
export interface ConversationSummary {
  learnerTurns: number;
  goalsCompleted: readonly string[];
  goalsTotal: number;
  scenarioDone: boolean;
  corrections: readonly Correction[];
  /** Recasts only: these become reviews. */
  recasts: readonly (TutorRecast & { learnerMessage: string })[];
  newWords: readonly NewWord[];
  /** Error counts per tag, most frequent first. */
  errorCounts: readonly { tag: string; count: number }[];
}

/** Every correction, in order, with the message it corrected. */
export function correctionsOf(turns: readonly TutorTurn[]): Correction[] {
  const out: Correction[] = [];
  let lastLearner: string | null = null;
  for (const turn of turns) {
    if (turn.role === 'learner') {
      lastLearner = turn.text;
      continue;
    }
    const { prompt, recast } = turn.output.annotations;
    if (lastLearner === null) continue;
    if (recast !== null) {
      out.push({ learnerMessage: lastLearner, kind: 'recast', ...recast });
    } else if (prompt !== null) {
      out.push({ learnerMessage: lastLearner, kind: 'prompt', ...prompt, correctedText: null });
    }
  }
  return out;
}

/** Summarise a conversation for its end screen. */
export function summariseConversation(
  state: ConversationState,
  context: TutorContext,
): ConversationSummary {
  const corrections = correctionsOf(state.turns);
  const counts = new Map<string, number>();
  for (const c of corrections) {
    for (const tag of c.errorTags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  const words = new Map<string, NewWord>();
  for (const t of state.turns) {
    if (t.role !== 'tutor') continue;
    for (const w of t.output.annotations.newWords) words.set(w.lemma.toLocaleLowerCase('it'), w);
  }
  return {
    learnerTurns: learnerTurnCount(state),
    goalsCompleted: state.goalsCompleted,
    goalsTotal: context.scenario.goals.length,
    scenarioDone: state.scenarioDone,
    corrections,
    recasts: corrections
      .filter((c) => c.kind === 'recast' && c.correctedText !== null)
      .map((c) => ({
        learnerMessage: c.learnerMessage,
        learnerText: c.learnerText,
        correctedText: c.correctedText ?? '',
        errorTags: c.errorTags,
      })),
    newWords: [...words.values()],
    errorCounts: [...counts]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)),
  };
}
