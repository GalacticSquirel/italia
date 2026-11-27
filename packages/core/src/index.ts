/**
 * `@italia/core`: Italia's learning logic in pure TypeScript.
 *
 * This package must never import React, React Native or Expo. Screens in the
 * app call into it; everything here is unit tested in Node.
 *
 * Fakes of the on-device AI providers for tests live in `@italia/core/testing`.
 *
 * @packageDocumentation
 */

export {
  createScheduler,
  DEFAULT_DESIRED_RETENTION,
  DEFAULT_MAXIMUM_INTERVAL_DAYS,
  retrievability,
  type Scheduler,
  type SchedulerOptions,
} from './scheduler';
export {
  CARD_KINDS,
  CARD_STATES,
  PROMPT_MODES,
  RATINGS,
  type CardKind,
  type CardSchedule,
  type CardState,
  type PromptMode,
  type Rating,
  type ReviewOutcomeLog,
  type ReviewResult,
} from './types';
export { createRng, shuffle, type Rng } from './rng';
export { fnv1a32, fnv1a32Hex } from './hash';
export { normaliseAnswer } from './normalise';
export { diffStrings, type DiffSegment, type DiffSegmentType } from './edit-distance';
export {
  DEFAULT_CHARS_PER_TYPO,
  DEFAULT_EASY_LATENCY_MS,
  DEFAULT_SPOKEN_CHARS_PER_TYPO,
  gradeAnswer,
  gradeSpoken,
  gradeTyped,
  ratingFor,
  type EasyLatencyThresholds,
  type GradedResponse,
  type GradedSpokenResponse,
  type GradeOptions,
  type GradeResult,
  type GradeVerdict,
  type GradingConfig,
  type RatingContext,
  type SpokenResponse,
  type TypedResponse,
} from './grade';
export {
  DEFAULT_SECONDS_PER_ITEM,
  estimateItemSeconds,
  NEW_ITEM_COST_FACTOR,
  projectedLoad,
  type DayLoad,
  type ForecastCard,
  type ItemSource,
  type LoadForecast,
  type ProjectedLoadInput,
} from './load';
export { interleaveItems, type Interleavable, type InterleaveOptions } from './interleave';
export {
  buildSession,
  DEFAULT_SESSION_SETTINGS,
  type BuildSessionInput,
  type NewCandidate,
  type NewItemLimitReason,
  type SessionCard,
  type SessionItem,
  type SessionPlan,
  type SessionSettings,
  type SessionTuning,
} from './session';
export {
  currentEntry,
  recordAnswer,
  startSessionQueue,
  type CompletedEntry,
  type QueueEntry,
  type QueueOptions,
  type SessionQueue,
} from './session-queue';
export {
  coverage,
  DEFAULT_COVERAGE_WINDOW,
  DEFAULT_KNOWN_OPTIONS,
  isKnown,
  knownLemmaCount,
  knownLemmaIds,
  storyFits,
  type CoverageOptions,
  type CoverageResult,
  type CoverageToken,
  type KnownOptions,
  type LemmaCard,
} from './progress';
export {
  DEFAULT_COVERAGE_FLOOR,
  selectStories,
  storyFit,
  type EpisodeStatus,
  type SelectableStory,
  type SeriesStatus,
  type StoryFit,
  type StorySelection,
  type StorySelectionInput,
} from './story-selection';
export {
  buildComprehensionCheck,
  type ClozeQuestion,
  type ComprehensionOptions,
  type ComprehensionQuestion,
  type ComprehensionSentence,
  type ComprehensionToken,
  type TrueFalseQuestion,
} from './comprehension';
export {
  CEFR_LEMMA_THRESHOLDS,
  CEFR_LEVELS,
  estimateCefr,
  projectHoursToNextLevel,
  type CefrConfidence,
  type CefrEstimate,
  type CefrEstimateLevel,
  type CefrInput,
  type CefrLevel,
  type HoursProjection,
  type HoursProjectionInput,
} from './cefr';
export {
  addDays,
  daysBetween,
  localDateInTimeZone,
  type LocalDate,
  type LocalDateFn,
} from './local-date';
export {
  INITIAL_STREAK_STATE,
  recordStudy,
  viewStreak,
  type DayProgress,
  type PendingRepair,
  type StreakConfig,
  type StreakEvent,
  type StreakState,
  type StreakStatus,
  type StreakUpdate,
  type StreakView,
  type StudyActivity,
} from './streak';
export { replayStreak, type ReplaySession } from './streak-replay';
export {
  compareLogs,
  mergeLogs,
  rebuildCardState,
  rebuildCardStates,
  type ReplayLog,
  type ReplayOptions,
} from './replay';
export type {
  AbortSignalLike,
  AiProvider,
  AudioClip,
  CallOptions,
  ConversationPartner,
  ConversationReply,
  ConversationReplyResult,
  ConversationRequest,
  ConversationTurn,
  GeneratedStory,
  Gloss,
  Glosser,
  GlossRequest,
  LearnerError,
  PhonemeScore,
  PronunciationIssue,
  PronunciationRequest,
  PronunciationScore,
  PronunciationScorer,
  ProviderAvailability,
  SpeechRequest,
  SpeechToText,
  StoryGenerator,
  StoryRequest,
  SynthesisedSpeech,
  TextToSpeech,
  TimedText,
  Transcript,
  TranscribeOptions,
  Voice,
  WordPronunciation,
} from './providers';

// The on-device tutor contract and conversation logic (see `./tutor`).
export * from './tutor';
export {
  ACTIVITIES,
  buildDailyPath,
  CONVERSATION_MIN_WORDS,
  DAILY_STEP_IDS,
  rotateDaily,
  type Activity,
  type DailyExtra,
  type DailyPath,
  type DailyPathInput,
  type DailyStep,
  type DailyStepId,
  type DailyStepStatus,
  type DailyUnlock,
} from './daily-path';
