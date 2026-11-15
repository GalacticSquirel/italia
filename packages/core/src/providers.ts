/**
 * Interfaces for the on-device AI features (ADR 0004). Implementations live
 * in the app (native runtimes) and are injected; screens and core logic
 * depend only on these types, and tests use the fakes in
 * `@italia/core/testing`.
 *
 * Every call takes an optional abort signal. Once it fires, an
 * implementation must stop promptly and release any native work: promise
 * calls reject with the signal's `reason`; a conversation reply ends its
 * token stream and resolves `result` with `finishReason: 'aborted'`.
 */

import type { CefrLevel } from './cefr';

/**
 * The part of the standard `AbortSignal` the providers use. A real
 * `AbortSignal` satisfies it; this package does not depend on DOM types.
 */
export interface AbortSignalLike {
  readonly aborted: boolean;
  readonly reason?: unknown;
  addEventListener(type: 'abort', listener: () => void, options?: { once?: boolean }): void;
  removeEventListener(type: 'abort', listener: () => void): void;
}

/** Options accepted by every provider call. */
export interface CallOptions {
  signal?: AbortSignalLike;
}

/**
 * Whether a provider can run now:
 *
 * - `ready`: loaded or loadable
 * - `needs_download`: its model has not been downloaded yet
 * - `unsupported`: this device cannot run it (for example too little memory)
 */
export type ProviderAvailability = 'ready' | 'needs_download' | 'unsupported';

/** Common to every provider. */
export interface AiProvider {
  /** Stable identifier of the implementation and model, for logs and settings. */
  readonly id: string;
  availability(): Promise<ProviderAvailability>;
}

/** Audio passed to or returned from a provider. */
export type AudioClip =
  { kind: 'file'; uri: string } | { kind: 'pcm'; samples: Float32Array; sampleRateHz: number };

/** A span of text with its position in audio. */
export interface TimedText {
  text: string;
  startMs: number;
  endMs: number;
}

// ---------------------------------------------------------------------------
// Story generation
// ---------------------------------------------------------------------------

/** What to write. The caller checks coverage and grammar of the result. */
export interface StoryRequest {
  level: CefrLevel;
  /** Lemmas the learner knows; the story should use mostly these. */
  knownLemmas: readonly string[];
  /** Lemmas to introduce (typically 3 to 6). */
  targetLemmas: readonly string[];
  /** Grammar the story may use, by title or tag. */
  allowedGrammar: readonly string[];
  /** Approximate length in words. */
  lengthWords: number;
  topic?: string;
  /** Earlier episodes of a series, for continuity. */
  previousEpisodes?: readonly string[];
}

/** A generated story. */
export interface GeneratedStory {
  title: string;
  /** Italian text, paragraphs separated by blank lines. */
  body: string;
  /** English translation of the body, if produced. */
  translation?: string;
}

/** Writes graded stories on the device. */
export interface StoryGenerator extends AiProvider {
  generate(request: StoryRequest, options?: CallOptions): Promise<GeneratedStory>;
}

// ---------------------------------------------------------------------------
// Conversation
// ---------------------------------------------------------------------------

/** One turn of a conversation. */
export interface ConversationTurn {
  role: 'learner' | 'partner';
  text: string;
}

/** Context for the partner's next turn. */
export interface ConversationRequest {
  level: CefrLevel;
  /** Scenario instructions, for example "ordering at a bar in Rome". */
  scenario: string;
  history: readonly ConversationTurn[];
}

/** A learner error found in the last learner turn. */
export interface LearnerError {
  /** Error taxonomy key, for example `agreement.gender` (stored in `error_record.category`). */
  category: string;
  /** The erroneous text as written. */
  original: string;
  /** The corrected text. */
  corrected: string;
}

/** Everything the partner produced for a turn, once streaming ends. */
export interface ConversationReplyResult {
  /** The partner's full reply. */
  text: string;
  /** A recast of the learner's last turn when it had errors, else null. */
  recast: string | null;
  errors: readonly LearnerError[];
  /** Why generation stopped. */
  finishReason: 'complete' | 'length' | 'aborted';
}

/** A streaming reply. */
export interface ConversationReply {
  /** The reply text as it is generated, in order. Iterate once. */
  tokens: AsyncIterable<string>;
  /** Resolves when generation ends; rejects on failure. */
  result: Promise<ConversationReplyResult>;
}

/** Plays the other side of a spoken or typed conversation scenario. */
export interface ConversationPartner extends AiProvider {
  reply(request: ConversationRequest, options?: CallOptions): ConversationReply;
}

// ---------------------------------------------------------------------------
// Glosses
// ---------------------------------------------------------------------------

/** A word to explain in its context. */
export interface GlossRequest {
  /** The word as it appears in the text. */
  word: string;
  /** The sentence it appears in. */
  sentence: string;
}

/** A contextual gloss. */
export interface Gloss {
  lemma: string;
  /** Universal POS tag, for example NOUN or VERB. */
  partOfSpeech: string;
  /** English meaning in this context. */
  translation: string;
  /** Short note, for example on the verb form. */
  note?: string;
}

/** Explains words that are not in the bundled dictionary. */
export interface Glosser extends AiProvider {
  gloss(request: GlossRequest, options?: CallOptions): Promise<Gloss>;
}

// ---------------------------------------------------------------------------
// Pronunciation
// ---------------------------------------------------------------------------

/** What to score. */
export interface PronunciationRequest {
  audio: AudioClip;
  /** The Italian text the learner was asked to say. */
  expectedText: string;
}

/** Score for one phoneme, 0 (poor) to 1 (native-like). */
export interface PhonemeScore {
  phoneme: string;
  score: number;
  startMs: number;
  endMs: number;
}

/** Score for one word. */
export interface WordPronunciation {
  word: string;
  score: number;
  phonemes: readonly PhonemeScore[];
}

/** A specific issue worth pointing out. */
export interface PronunciationIssue {
  kind: 'double_consonant' | 'stress' | 'vowel_quality' | 'other';
  /** Index into `words`. */
  wordIndex: number;
  message: string;
}

/** Result of scoring. Guidance only: it never changes a review rating. */
export interface PronunciationScore {
  /** Overall score, 0 to 1. */
  overall: number;
  words: readonly WordPronunciation[];
  issues: readonly PronunciationIssue[];
}

/** Scores pronunciation against expected text. */
export interface PronunciationScorer extends AiProvider {
  score(request: PronunciationRequest, options?: CallOptions): Promise<PronunciationScore>;
}

// ---------------------------------------------------------------------------
// Speech to text
// ---------------------------------------------------------------------------

/** Options for transcription. */
export interface TranscribeOptions extends CallOptions {
  /** BCP 47 language; defaults to `it`. */
  language?: string;
  /** Words likely to occur (for example the expected answer), to bias recognition. */
  hint?: string;
}

/** A transcript. */
export interface Transcript {
  text: string;
  segments: readonly TimedText[];
  /** Recogniser confidence from 0 to 1, when available. */
  confidence?: number;
}

/** Transcribes recorded speech. */
export interface SpeechToText extends AiProvider {
  transcribe(audio: AudioClip, options?: TranscribeOptions): Promise<Transcript>;
}

// ---------------------------------------------------------------------------
// Text to speech
// ---------------------------------------------------------------------------

/** A voice available for synthesis. */
export interface Voice {
  id: string;
  /** BCP 47 language, for example `it-IT`. */
  language: string;
  name: string;
}

/** What to say. */
export interface SpeechRequest {
  text: string;
  /** Defaults to the provider's default Italian voice. */
  voiceId?: string;
  /** Speaking rate, 1 = normal. */
  rate?: number;
}

/** Synthesised speech. */
export interface SynthesisedSpeech {
  audio: AudioClip;
  /** Word timings for transcript highlighting, when available. */
  wordTimings: readonly TimedText[];
}

/** Synthesises speech for text not covered by bundled audio. */
export interface TextToSpeech extends AiProvider {
  voices(options?: CallOptions): Promise<readonly Voice[]>;
  synthesise(request: SpeechRequest, options?: CallOptions): Promise<SynthesisedSpeech>;
}
