/**
 * Runs a drill's side effects around the pure {@link drillReducer}: speaks
 * the English cue, records the answer (stopping at the end of speech or on
 * "Done"), transcribes and grades it, scores pronunciation in parallel,
 * prompts one retry, and plays the model answer.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import {
  sayEnglish,
  recordingClip,
  sayItalian,
  useSpeech,
  type PronunciationAnalysis,
} from '@/speech';

import {
  createDrill,
  currentItem,
  drillReducer,
  type DrillItem,
  type DrillOutcome,
  type DrillState,
} from './drillMachine';
import { createSilenceDetector, type SilenceOptions, type StopReason } from './silence';

/** Options for {@link useDrillRunner}. */
export interface DrillRunnerOptions {
  items: readonly DrillItem[];
  /** Italian speech rate. */
  rate?: number;
  /** Hands-free: start, advance and skip silent answers without taps. */
  handsFree?: boolean;
  /** Prompt one retry after a miss. Default true. */
  allowRetry?: boolean;
  /** Called once per graded item, as soon as it is graded. */
  onOutcome?: (outcome: DrillOutcome) => void;
  /** Called when the learner moves past the last item. */
  onFinished?: (outcomes: readonly DrillOutcome[]) => void;
  silence?: SilenceOptions;
  /** Pause before the next item in hands-free mode. Default 1500 ms. */
  handsFreeGapMs?: number;
  /** Clock in milliseconds. */
  now?: () => number;
}

/** The running drill. */
export interface DrillRunner {
  state: DrillState;
  /** Pronunciation analysis of the last attempt, when the scorer is installed. */
  analysis: PronunciationAnalysis | null;
  /** Whether pronunciation scoring is installed. */
  scorerReady: boolean;
  /** Microphone input level, 0 to 1, while listening. */
  level: number;
  start: () => void;
  /** Stop recording now ("Done"). */
  finishAnswer: () => void;
  /** Listen again after nothing was heard. */
  listenAgain: () => void;
  next: () => void;
  skip: () => void;
  /** Play the model answer again. */
  replayAnswer: () => void;
}

const SPEECH_LEVEL = 0.08;

/** Drive a drill; see {@link DrillRunnerOptions}. */
export function useDrillRunner(options: DrillRunnerOptions): DrillRunner {
  const services = useSpeech();
  const { items, rate = 1, handsFree = false, allowRetry = true } = options;
  const [state, dispatch] = useReducer(drillReducer, items, (i) => createDrill(i, { allowRetry }));
  // Analysis of an attempt, kept with the attempt it belongs to.
  const [scored, setScored] = useState<{
    index: number;
    attempt: number;
    analysis: PronunciationAnalysis;
  } | null>(null);
  const [scorerReady, setScorerReady] = useState(false);
  // Read by the recording effect without restarting it.
  const scorerReadyRef = useRef(false);
  const [level, setLevel] = useState(0);
  const [listenToken, setListenToken] = useState(0);
  const mounted = useRef(true);
  const stopRef = useRef<(() => void) | null>(null);
  const callbacks = useRef(options);
  useEffect(() => {
    callbacks.current = options;
  });
  const item = currentItem(state);

  useEffect(() => {
    mounted.current = true;
    void services.scorer.availability().then((a) => {
      scorerReadyRef.current = a === 'ready';
      if (mounted.current) setScorerReady(a === 'ready');
    });
    return () => {
      mounted.current = false;
      services.recorder.cancel();
      services.audio.stop();
    };
  }, [services]);

  const safeDispatch = useCallback((event: Parameters<typeof dispatch>[0]) => {
    if (mounted.current) dispatch(event);
  }, []);

  // Hands-free starts by itself.
  useEffect(() => {
    if (handsFree && state.phase === 'ready') dispatch({ type: 'start' });
  }, [handsFree, state.phase]);

  // Cue: say the English, then listen.
  useEffect(() => {
    if (state.phase !== 'cue' || !item) return;
    let cancelled = false;
    void sayEnglish(services, item.cue)
      .catch(() => undefined)
      .then(() => {
        if (!cancelled) safeDispatch({ type: 'cueDone' });
      });
    return () => {
      cancelled = true;
    };
  }, [state.phase, state.index, item, services, safeDispatch]);

  // Listening: record until the end of speech, "Done", or the time limit.
  useEffect(() => {
    if (state.phase !== 'listening' || !item) return;
    const index = state.index;
    const attempt = state.attempt;
    const now = callbacks.current.now ?? Date.now;
    const detector = createSilenceDetector(callbacks.current.silence);
    const startedAt = now();
    let lastSpeechAt: number | null = null;
    let stopping = false;
    let cancelled = false;

    const stop = (reason: StopReason | 'done') => {
      if (stopping || cancelled) return;
      stopping = true;
      stopRef.current = null;
      setLevel(0);
      if (reason === 'noSpeech') {
        services.recorder.cancel();
        if (callbacks.current.handsFree === true) safeDispatch({ type: 'skip' });
        else safeDispatch({ type: 'failed', message: 'I did not hear anything.' });
        return;
      }
      const stoppedAt = now();
      const latencyMs = Math.max(0, (lastSpeechAt ?? stoppedAt) - startedAt);
      void (async () => {
        try {
          const recording = await services.recorder.stop();
          safeDispatch({ type: 'recorded' });
          const clip = recordingClip(recording);
          if (scorerReadyRef.current) {
            void services.scorer
              .analyse({ audio: clip, expectedText: item.answer })
              .then((result) => {
                if (!mounted.current) return;
                setScored({ index, attempt, analysis: result });
                dispatch({ type: 'scored', score: result.score, attempt, index });
              })
              .catch(() => undefined);
          }
          const transcript = await services.stt.transcribe(clip, { language: 'it' });
          safeDispatch({ type: 'transcribed', transcript: transcript.text, latencyMs });
        } catch (e) {
          safeDispatch({
            type: 'failed',
            message: e instanceof Error ? e.message : 'Speech recognition failed.',
          });
        }
      })();
    };
    stopRef.current = () => {
      stop('done');
    };

    void services.recorder
      .start((input) => {
        if (cancelled || stopping) return;
        const at = now();
        setLevel(input);
        if (input >= SPEECH_LEVEL) lastSpeechAt = at;
        const reason = detector.push(input, at - startedAt);
        if (reason !== null) stop(reason);
      })
      .catch((e: unknown) => {
        stopping = true;
        safeDispatch({
          type: 'failed',
          message: e instanceof Error ? e.message : 'The microphone could not start.',
        });
      });
    return () => {
      cancelled = true;
      stopRef.current = null;
      if (!stopping) services.recorder.cancel();
    };
    // `listenToken` restarts listening after "Try again".
  }, [state.phase, state.index, state.attempt, item, listenToken, services, safeDispatch]);

  // Retry: one more go, prompted before the model answer is given.
  useEffect(() => {
    if (state.phase !== 'retry') return;
    let cancelled = false;
    void sayEnglish(services, 'Not quite. Try once more.')
      .catch(() => undefined)
      .then(() => {
        if (!cancelled) safeDispatch({ type: 'retryDone' });
      });
    return () => {
      cancelled = true;
    };
  }, [state.phase, services, safeDispatch]);

  // Answer: report the outcome and play the model answer.
  const reported = useRef(0);
  useEffect(() => {
    if (state.outcomes.length > reported.current) {
      const outcome = state.outcomes[state.outcomes.length - 1];
      reported.current = state.outcomes.length;
      if (outcome) callbacks.current.onOutcome?.(outcome);
    }
  }, [state.outcomes]);

  useEffect(() => {
    if (state.phase !== 'answer' || !item) return;
    let cancelled = false;
    void sayItalian(services, item.answer, rate)
      .catch(() => null)
      .then(() => {
        if (!cancelled) safeDispatch({ type: 'answerDone' });
      });
    return () => {
      cancelled = true;
    };
  }, [state.phase, state.index, item, services, rate, safeDispatch]);

  // Hands-free: move on after a short pause.
  useEffect(() => {
    if (!handsFree || state.phase !== 'feedback') return;
    const timer = setTimeout(() => {
      safeDispatch({ type: 'next' });
    }, options.handsFreeGapMs ?? 1500);
    return () => {
      clearTimeout(timer);
    };
  }, [handsFree, state.phase, state.index, options.handsFreeGapMs, safeDispatch]);

  const finished = useRef(false);
  useEffect(() => {
    if (state.phase === 'done' && !finished.current && state.items.length > 0) {
      finished.current = true;
      callbacks.current.onFinished?.(state.outcomes);
    }
  }, [state.phase, state.items.length, state.outcomes]);

  const analysis =
    scored?.index === state.index && scored.attempt === state.attempt ? scored.analysis : null;
  return {
    state,
    analysis,
    scorerReady,
    level,
    start: () => {
      dispatch({ type: 'start' });
    },
    finishAnswer: () => {
      stopRef.current?.();
    },
    listenAgain: () => {
      setListenToken((t) => t + 1);
    },
    next: () => {
      services.audio.stop();
      dispatch({ type: 'next' });
    },
    skip: () => {
      services.audio.stop();
      services.recorder.cancel();
      dispatch({ type: 'skip' });
    },
    replayAnswer: () => {
      if (item) void sayItalian(services, item.answer, rate).catch(() => null);
    },
  };
}
