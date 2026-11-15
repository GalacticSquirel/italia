/**
 * Story playback as a small state machine, independent of React and of the
 * speech engine (both are injected, so tests drive it with a fake speaker and
 * a fake clock).
 *
 * States: `idle` (nothing playing), `loading` (synthesising the current
 * sentence), `playing`, `paused`, `ended` (the whole story finished) and
 * `error`. A story plays sentence by sentence, preparing the next sentence
 * while the current one plays. Pausing stops the audio; resuming replays the
 * current sentence from its start (speech engines cannot resume mid-word
 * reliably, and a learner benefits from hearing the sentence whole).
 */
import { tokenAtChar, wordAt, type TokenSpan, type WordTimings } from './timings';

/** Slowest and fastest playback speeds offered. */
export const MIN_RATE = 0.75;
export const MAX_RATE = 1.25;

/** How often the highlighted word is updated from timings, in milliseconds. */
export const TICK_MS = 50;

/** A sentence to speak. */
export interface PlaybackSentence {
  text: string;
  tokens: readonly TokenSpan[];
}

/** Where the word highlighting comes from. */
export type TimingSource = 'engine' | 'estimated';

/** Which voice is speaking. */
export type VoiceKind = 'neural' | 'device';

/** A sentence ready to play. */
export interface PreparedSpeech {
  voice: VoiceKind;
  /**
   * Token timings from the start of playback, when known before playing
   * (from the engine, or estimated). Null when only live word events come.
   */
  timings: WordTimings | null;
  /** Source of `timings`. */
  timing: TimingSource;
  /**
   * Play to the end. Resolves when finished or once `signal` aborts (the
   * speaker stops the audio). Engines that report words as they speak call
   * `onBoundary` with the character index of each word.
   */
  play(signal: AbortSignal, onBoundary: (charIndex: number) => void): Promise<void>;
}

/** Turns sentences into playable speech. */
export interface SentenceSpeaker {
  prepare(sentence: PlaybackSentence, rate: number, signal: AbortSignal): Promise<PreparedSpeech>;
}

/** Time source and timer, injectable for tests. */
export interface PlaybackClock {
  now(): number;
  /** Call `fn` every `ms` milliseconds until the returned function is called. */
  every(ms: number, fn: () => void): () => void;
}

/** The system clock. */
export const systemClock: PlaybackClock = {
  now: () => Date.now(),
  every(ms, fn) {
    const id = setInterval(fn, ms);
    return () => {
      clearInterval(id);
    };
  },
};

/** Playback status. */
export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';

/** Playback state, for rendering. */
export interface PlaybackState {
  status: PlaybackStatus;
  /** Playing the whole story from here, or a single sentence. */
  scope: 'story' | 'sentence';
  /** The current (or last) sentence. */
  sentenceIndex: number;
  /** The token being spoken, or null. */
  wordIndex: number | null;
  rate: number;
  /** Where word highlighting comes from, once known. */
  timing: TimingSource | null;
  voice: VoiceKind | null;
  error: string | null;
}

/** Called when a sentence finishes playing in full. */
export type SentenceDoneListener = (sentenceIndex: number) => void;

/** The playback controller. */
export interface PlaybackController {
  getState(): PlaybackState;
  subscribe(listener: () => void): () => void;
  /** Play the story from sentence `from` (defaults to the current sentence). */
  playStory(from?: number): void;
  /** Play one sentence, then stop. */
  playSentence(index: number): void;
  pause(): void;
  /** Replay the current sentence and carry on in the paused scope. */
  resume(): void;
  /** Play or pause, as a single button does. */
  toggle(): void;
  /** Change the speed (clamped to 0.75 to 1.25); restarts the current sentence if playing. */
  setRate(rate: number): void;
  /** Stop and release everything. */
  dispose(): void;
}

/** Options for {@link createPlaybackController}. */
export interface PlaybackOptions {
  sentences: readonly PlaybackSentence[];
  speaker: SentenceSpeaker;
  clock?: PlaybackClock;
  /** Initial speed; defaults to 1. */
  rate?: number;
  /** Initial sentence; defaults to 0. */
  startAt?: number;
  onSentenceDone?: SentenceDoneListener;
  /** Called when the whole story has played to the end. */
  onEnded?: () => void;
}

/** Clamp a speed to the offered range, to two decimals. */
export function clampRate(rate: number): number {
  if (!Number.isFinite(rate)) return 1;
  return Math.round(Math.min(MAX_RATE, Math.max(MIN_RATE, rate)) * 100) / 100;
}

const noop = (): void => undefined;

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/** Create a {@link PlaybackController}. */
export function createPlaybackController(options: PlaybackOptions): PlaybackController {
  const { sentences, speaker } = options;
  const clock = options.clock ?? systemClock;
  const listeners = new Set<() => void>();
  const last = Math.max(0, sentences.length - 1);
  let state: PlaybackState = {
    status: 'idle',
    scope: 'story',
    sentenceIndex: Math.min(Math.max(0, options.startAt ?? 0), last),
    wordIndex: null,
    rate: clampRate(options.rate ?? 1),
    timing: null,
    voice: null,
    error: null,
  };
  /** The running playback, if any; replaced (and aborted) on every change. */
  let run: AbortController | null = null;
  /** Prepared speech by sentence, for the current rate (prefetch). */
  let cache = new Map<number, Promise<PreparedSpeech>>();
  let cacheAbort = new AbortController();
  let disposed = false;

  const set = (patch: Partial<PlaybackState>) => {
    state = { ...state, ...patch };
    for (const l of [...listeners]) l();
  };

  const prepared = (index: number): Promise<PreparedSpeech> => {
    const existing = cache.get(index);
    if (existing) return existing;
    const sentence = sentences[index];
    if (!sentence) return Promise.reject(new Error(`No sentence ${String(index)}`));
    const promise = speaker.prepare(sentence, state.rate, cacheAbort.signal);
    // A failed preparation is retried next time rather than cached.
    promise.catch(() => {
      if (cache.get(index) === promise) cache.delete(index);
    });
    cache.set(index, promise);
    return promise;
  };

  const resetCache = () => {
    cacheAbort.abort();
    cacheAbort = new AbortController();
    cache = new Map();
  };

  const stopRun = () => {
    run?.abort();
    run = null;
  };

  const playFrom = async (scope: PlaybackState['scope'], from: number, ac: AbortController) => {
    // A function, so each check reads the signal afresh across awaits.
    const cancelled = () => ac.signal.aborted;
    for (let i = from; i < sentences.length; i++) {
      const sentence = sentences[i];
      if (!sentence) break;
      set({ status: 'loading', scope, sentenceIndex: i, wordIndex: null, error: null });
      let speech: PreparedSpeech;
      try {
        speech = await prepared(i);
      } catch (error) {
        if (cancelled()) return;
        set({
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
        run = null;
        return;
      }
      if (cancelled()) return;
      set({ status: 'playing', voice: speech.voice, timing: speech.timing });
      if (scope === 'story' && i + 1 < sentences.length) {
        prepared(i + 1).catch(() => undefined);
      }

      const startedAt = clock.now();
      let stopTicking = noop;
      if (speech.timings) {
        const timings = speech.timings;
        const tick = () => {
          if (cancelled()) return;
          const word = wordAt(timings, clock.now() - startedAt);
          if (word !== state.wordIndex) set({ wordIndex: word });
        };
        tick();
        stopTicking = clock.every(TICK_MS, tick);
      }
      try {
        await speech.play(ac.signal, (charIndex) => {
          if (cancelled()) return;
          // Live word events are exact: they replace any estimate.
          stopTicking();
          set({ wordIndex: tokenAtChar(sentence.tokens, charIndex), timing: 'engine' });
        });
      } catch (error) {
        stopTicking();
        if (cancelled() || isAbort(error)) return;
        set({ status: 'error', error: error instanceof Error ? error.message : String(error) });
        run = null;
        return;
      }
      stopTicking();
      if (cancelled()) return;
      options.onSentenceDone?.(i);
      if (scope === 'sentence') {
        set({ status: 'idle', wordIndex: null });
        run = null;
        return;
      }
    }
    if (cancelled()) return;
    run = null;
    set({ status: 'ended', wordIndex: null });
    options.onEnded?.();
  };

  const start = (scope: PlaybackState['scope'], from: number) => {
    if (disposed || sentences.length === 0) return;
    stopRun();
    const ac = new AbortController();
    run = ac;
    void playFrom(scope, Math.min(Math.max(0, from), last), ac);
  };

  const controller: PlaybackController = {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    playStory(from) {
      start('story', from ?? (state.status === 'ended' ? 0 : state.sentenceIndex));
    },
    playSentence(index) {
      start('sentence', index);
    },
    pause() {
      if (state.status !== 'playing' && state.status !== 'loading') return;
      stopRun();
      set({ status: 'paused', wordIndex: null });
    },
    resume() {
      if (state.status !== 'paused' && state.status !== 'error') return;
      start(state.scope, state.sentenceIndex);
    },
    toggle() {
      switch (state.status) {
        case 'playing':
        case 'loading':
          controller.pause();
          return;
        case 'paused':
        case 'error':
          controller.resume();
          return;
        case 'ended':
          controller.playStory(0);
          return;
        case 'idle':
          controller.playStory(state.sentenceIndex);
      }
    },
    setRate(rate) {
      const next = clampRate(rate);
      if (next === state.rate) return;
      const wasActive = state.status === 'playing' || state.status === 'loading';
      stopRun();
      resetCache();
      set({ rate: next });
      if (wasActive) start(state.scope, state.sentenceIndex);
    },
    dispose() {
      disposed = true;
      stopRun();
      resetCache();
      listeners.clear();
    },
  };
  return controller;
}
