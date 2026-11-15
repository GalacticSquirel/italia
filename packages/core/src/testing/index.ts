/**
 * `@italia/core/testing`: small, deterministic fakes of the AI provider
 * interfaces, for tests of code that uses them. Not for production use.
 *
 * @packageDocumentation
 */

import type {
  AbortSignalLike,
  AudioClip,
  CallOptions,
  ConversationPartner,
  ConversationReply,
  ConversationReplyResult,
  ConversationRequest,
  GeneratedStory,
  Gloss,
  Glosser,
  LearnerError,
  PronunciationRequest,
  PronunciationScore,
  PronunciationScorer,
  ProviderAvailability,
  SpeechToText,
  StoryGenerator,
  StoryRequest,
  TextToSpeech,
  TimedText,
  Voice,
} from '../providers';

/** An abort controller for tests, independent of DOM or Node typings. */
export interface TestAbortController {
  readonly signal: AbortSignalLike;
  abort(reason?: unknown): void;
}

/** Create a {@link TestAbortController}. */
export function createTestAbortController(): TestAbortController {
  const listeners = new Set<() => void>();
  const state: { aborted: boolean; reason: unknown } = { aborted: false, reason: undefined };
  const signal: AbortSignalLike = {
    get aborted() {
      return state.aborted;
    },
    get reason() {
      return state.reason;
    },
    addEventListener(_type, listener) {
      listeners.add(listener);
    },
    removeEventListener(_type, listener) {
      listeners.delete(listener);
    },
  };
  return {
    signal,
    abort(reason?: unknown) {
      if (state.aborted) return;
      state.aborted = true;
      state.reason = reason ?? abortError();
      for (const listener of [...listeners]) listener();
      listeners.clear();
    },
  };
}

function abortError(): Error {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

/** Throw the signal's reason if it has fired. */
export function throwIfAborted(signal: AbortSignalLike | undefined): void {
  if (signal?.aborted === true) {
    throw signal.reason instanceof Error ? signal.reason : abortError();
  }
}

/** Run `fn` asynchronously unless the call's signal has already fired. */
function guarded<T>(call: CallOptions | undefined, fn: () => T): Promise<T> {
  return Promise.resolve().then(() => {
    throwIfAborted(call?.signal);
    return fn();
  });
}

function wordsOf(text: string): string[] {
  return text.split(/\s+/u).filter((w) => w.length > 0);
}

interface FakeBase {
  availability?: ProviderAvailability;
}

function base(id: string, options: FakeBase) {
  return {
    id,
    availability: () => Promise.resolve(options.availability ?? 'ready'),
  };
}

// ---------------------------------------------------------------------------

/** A fake {@link StoryGenerator} that records requests. */
export interface FakeStoryGenerator extends StoryGenerator {
  readonly requests: StoryRequest[];
}

/** Returns `story` for every request. */
export function createFakeStoryGenerator(
  options: FakeBase & { story?: GeneratedStory } = {},
): FakeStoryGenerator {
  const story = options.story ?? { title: 'Una giornata', body: 'Marco va al bar. Beve un caffè.' };
  const requests: StoryRequest[] = [];
  return {
    ...base('fake-story', options),
    requests,
    generate(request, call?: CallOptions) {
      return guarded(call, () => {
        requests.push(request);
        return { ...story };
      });
    },
  };
}

// ---------------------------------------------------------------------------

/** A scripted partner turn. */
export interface ScriptedReply {
  text: string;
  recast?: string | null;
  errors?: readonly LearnerError[];
}

/** Split text into word tokens, keeping leading spaces like an LLM tokenizer. */
function tokensOf(text: string): string[] {
  return text.match(/\s*\S+/gu) ?? [];
}

/**
 * Plays scripted replies in order (the last repeats), streaming one word per
 * token. Generation keeps one token ahead of the consumer, so iterate
 * `tokens` before awaiting `result`. Honours abort between tokens.
 */
export function createFakeConversationPartner(
  options: FakeBase & { replies?: readonly ScriptedReply[] } = {},
): ConversationPartner & { readonly requests: ConversationRequest[] } {
  const replies = options.replies ?? [{ text: 'Ciao! Come stai?' }];
  const requests: ConversationRequest[] = [];
  return {
    ...base('fake-conversation', options),
    requests,
    reply(request, call?: CallOptions): ConversationReply {
      const script = replies[Math.min(requests.length, replies.length - 1)] ?? { text: '' };
      requests.push(request);
      const signal = call?.signal;
      const aborted = () => signal?.aborted === true;
      const buffer: string[] = [];
      let done = false;
      // Resolvers for the consumer waiting on a token and the producer waiting on demand.
      let wakeConsumer: (() => void) | null = null;
      let wakeProducer: (() => void) | null = null;
      const invoke = (resolve: (() => void) | null) => {
        resolve?.();
      };
      const notifyConsumer = () => {
        const w = wakeConsumer;
        wakeConsumer = null;
        invoke(w);
      };
      const notifyProducer = () => {
        const w = wakeProducer;
        wakeProducer = null;
        invoke(w);
      };
      const onAbort = () => {
        notifyProducer();
        notifyConsumer();
      };
      signal?.addEventListener('abort', onAbort, { once: true });

      // Generates one token ahead of the consumer, like a model with backpressure.
      const result = (async (): Promise<ConversationReplyResult> => {
        let text = '';
        for (const token of tokensOf(script.text)) {
          while (buffer.length > 0 && !aborted()) {
            await new Promise<void>((resolve) => {
              wakeProducer = resolve;
            });
          }
          if (aborted()) {
            done = true;
            notifyConsumer();
            return { text, recast: null, errors: [], finishReason: 'aborted' };
          }
          buffer.push(token);
          text += token;
          notifyConsumer();
        }
        done = true;
        signal?.removeEventListener('abort', onAbort);
        notifyConsumer();
        return {
          text,
          recast: script.recast ?? null,
          errors: script.errors ?? [],
          finishReason: 'complete',
        };
      })();

      async function* tokens(): AsyncGenerator<string> {
        for (;;) {
          const next = buffer.shift();
          if (next !== undefined) {
            notifyProducer();
            yield next;
            continue;
          }
          if (done) return;
          await new Promise<void>((resolve) => {
            wakeConsumer = resolve;
          });
        }
      }

      return { tokens: tokens(), result };
    },
  };
}

// ---------------------------------------------------------------------------

/** Looks words up in a fixed dictionary (case-insensitive); rejects unknown words. */
export function createFakeGlosser(
  options: FakeBase & { dictionary?: Readonly<Record<string, Gloss>> } = {},
): Glosser {
  const dictionary = options.dictionary ?? {};
  return {
    ...base('fake-glosser', options),
    gloss(request, call?: CallOptions) {
      return guarded(call, () => {
        const entry = dictionary[request.word.toLocaleLowerCase('it')];
        if (entry === undefined) throw new Error(`no gloss for ${request.word}`);
        return { ...entry };
      });
    },
  };
}

// ---------------------------------------------------------------------------

/** Gives every word and phoneme the same score. */
export function createFakePronunciationScorer(
  options: FakeBase & { overall?: number } = {},
): PronunciationScorer {
  const overall = options.overall ?? 0.8;
  return {
    ...base('fake-pronunciation', options),
    score(request: PronunciationRequest, call?: CallOptions): Promise<PronunciationScore> {
      return guarded(call, () => ({
        overall,
        words: wordsOf(request.expectedText).map((word) => ({
          word,
          score: overall,
          phonemes: [],
        })),
        issues: [],
      }));
    },
  };
}

// ---------------------------------------------------------------------------

/** A fake {@link SpeechToText} that records the audio it was given. */
export interface FakeSpeechToText extends SpeechToText {
  readonly received: AudioClip[];
}

/** Returns scripted transcripts in order (the last repeats; empty when none). */
export function createFakeSpeechToText(
  options: FakeBase & { transcripts?: readonly string[] } = {},
): FakeSpeechToText {
  const transcripts = options.transcripts ?? [];
  const received: AudioClip[] = [];
  return {
    ...base('fake-stt', options),
    received,
    transcribe(audio, call) {
      return guarded(call, () => {
        const text = transcripts[Math.min(received.length, transcripts.length - 1)] ?? '';
        received.push(audio);
        return {
          text,
          segments: text === '' ? [] : [{ text, startMs: 0, endMs: 1000 }],
          confidence: 1,
        };
      });
    },
  };
}

// ---------------------------------------------------------------------------

const FAKE_VOICE: Voice = { id: 'fake-it', language: 'it-IT', name: 'Fake Italian' };
const MS_PER_WORD = 300;

/** Returns silent audio with evenly spaced word timings. */
export function createFakeTextToSpeech(options: FakeBase = {}): TextToSpeech {
  return {
    ...base('fake-tts', options),
    voices(call?: CallOptions) {
      return guarded(call, () => [FAKE_VOICE]);
    },
    synthesise(request, call?: CallOptions) {
      return guarded(call, () => {
        const wordTimings: TimedText[] = wordsOf(request.text).map((text, i) => ({
          text,
          startMs: i * MS_PER_WORD,
          endMs: (i + 1) * MS_PER_WORD,
        }));
        return {
          audio: { kind: 'pcm' as const, samples: new Float32Array(0), sampleRateHz: 16_000 },
          wordTimings,
        };
      });
    },
  };
}
