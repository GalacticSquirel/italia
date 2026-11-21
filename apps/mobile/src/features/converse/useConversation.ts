/**
 * Runs one tutor conversation: the core state machine plus the side effects
 * (asking the partner for turns, streaming, saving errors and review cards,
 * speaking replies).
 */
import { useCallback, useEffect, useReducer, useRef } from 'react';

import {
  canSend,
  conversationReducer,
  INITIAL_CONVERSATION,
  requestTutorTurn,
  type ConversationEvent,
  type ConversationPartner,
  type ConversationState,
  type TutorContext,
  type TutorOutput,
  type TutorTurn,
} from '@italia/core';

import { tutorLog } from '@/tutor';

/** A checked tutor turn and the learner message it answered. */
export interface TutorTurnEvent {
  output: TutorOutput;
  /** Null for the opening turn. */
  learnerMessage: string | null;
}

/** Options for {@link useConversation}. */
export interface UseConversationOptions {
  partner: ConversationPartner;
  context: TutorContext;
  /** Called once per checked tutor turn (save errors, speak the reply). */
  onTutorTurn?: (event: TutorTurnEvent) => void;
  /** Called with the learner's message when its reply was stopped, to edit and resend. */
  onRestoreDraft?: (text: string) => void;
}

/** The conversation and its controls. */
export interface ConversationControls {
  state: ConversationState;
  /** Open the scenario (the tutor speaks first). */
  start: () => void;
  /** Send the learner's message. Ignored unless it is the learner's turn. */
  send: (text: string) => void;
  /** Stop the reply being generated; the message comes back as a draft. */
  stop: () => void;
  /** Ask again after a failed reply. */
  retry: () => void;
  /** Finish the conversation. */
  end: () => void;
}

/** See the module documentation. */
export function useConversation({
  partner,
  context,
  onTutorTurn,
  onRestoreDraft,
}: UseConversationOptions): ConversationControls {
  const [state, rawDispatch] = useReducer(conversationReducer, INITIAL_CONVERSATION);
  /** The state after every event dispatched so far (ahead of rendering). */
  const latest = useRef(state);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const callbacks = useRef({ onTutorTurn, onRestoreDraft });

  useEffect(() => {
    callbacks.current = { onTutorTurn, onRestoreDraft };
  });

  const dispatch = useCallback((event: ConversationEvent) => {
    latest.current = conversationReducer(latest.current, event);
    rawDispatch(event);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);

  const run = useCallback(
    async (turns: readonly TutorTurn[], goalsCompleted: readonly string[]) => {
      const abort = new AbortController();
      controller.current = abort;
      const outcome = await requestTutorTurn(
        partner,
        context,
        { turns, goalsCompleted },
        {
          signal: abort.signal,
          onText: (text) => {
            if (mounted.current) dispatch({ type: 'token', text });
          },
        },
      );
      if (controller.current === abort) controller.current = null;
      if (!mounted.current) return;
      switch (outcome.kind) {
        case 'reply': {
          for (const reason of outcome.dropped) tutorLog(`dropped ${reason}`);
          const last = turns.at(-1);
          callbacks.current.onTutorTurn?.({
            output: outcome.output,
            learnerMessage: last?.role === 'learner' ? last.text : null,
          });
          dispatch({ type: 'reply', output: outcome.output, dropped: outcome.dropped });
          break;
        }
        case 'aborted': {
          const last = turns.at(-1);
          dispatch({ type: 'aborted' });
          if (last?.role === 'learner') callbacks.current.onRestoreDraft?.(last.text);
          break;
        }
        case 'failed':
          tutorLog(`turn failed: ${outcome.error}`);
          dispatch({ type: 'failed', error: outcome.error });
          break;
      }
    },
    [partner, context, dispatch],
  );

  const start = useCallback(() => {
    if (latest.current.phase !== 'idle') return;
    dispatch({ type: 'start' });
    void run([], []);
  }, [run, dispatch]);

  const send = useCallback(
    (text: string) => {
      const current = latest.current;
      const trimmed = text.trim();
      if (!canSend(current) || trimmed.length === 0) return;
      dispatch({ type: 'learner', text: trimmed });
      void run([...current.turns, { role: 'learner', text: trimmed }], current.goalsCompleted);
    },
    [run, dispatch],
  );

  const retry = useCallback(() => {
    const current = latest.current;
    if (current.phase !== 'failed') return;
    dispatch({ type: 'retry' });
    void run(current.turns, current.goalsCompleted);
  }, [run, dispatch]);

  const stop = useCallback(() => {
    controller.current?.abort();
  }, []);

  const end = useCallback(() => {
    controller.current?.abort();
    dispatch({ type: 'end' });
  }, [dispatch]);

  return { state, start, send, stop, retry, end };
}
