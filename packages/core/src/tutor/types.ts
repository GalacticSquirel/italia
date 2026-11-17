/**
 * Types of the on-device tutor contract (spec v1, `training/spec/models.py`).
 * Wire names are camelCase, exactly as the model reads and writes them.
 */

/** CEFR levels the tutor supports (C1 and above are out of scope for v1). */
export type TutorLevel = 'A1' | 'A2' | 'B1' | 'B2';

/** Tutor levels, lowest first. */
export const TUTOR_LEVELS: readonly TutorLevel[] = ['A1', 'A2', 'B1', 'B2'];

/** Limits for tutor replies at one level. */
export interface LevelBand {
  level: TutorLevel;
  /** Known-lemma ceiling (frequency rank); a learner's own ceiling may override it. */
  lemmaCeiling: number;
  maxWordsPerSentence: number;
  maxSentences: number;
  /** New lemmas above the ceiling a reply may introduce (declared in `newWords`). */
  maxNewWords: number;
  maxOutOfBandRatio: number;
  /** Whether a short English gloss in brackets is acceptable (A1 only). */
  englishAllowed: boolean;
}

/** One error tag of the learner-error taxonomy. */
export interface ErrorTagInfo {
  id: string;
  label: string;
  kind: string;
  /** Grammar point slugs this error is evidence about. */
  grammarPoints: readonly string[];
  description: string;
  example: { wrong: string; right: string };
}

/** A grammar point of the spec. */
export interface GrammarPointInfo {
  /** The content package's grammar point id, or null for training-only points. */
  id: number | null;
  slug: string;
  title: string;
  cefr: TutorLevel;
  prerequisites: readonly string[];
  inContent: boolean;
}

/** A goal the learner works through in a scenario. */
export interface ScenarioGoal {
  id: string;
  description: string;
}

/** An everyday task the learner role-plays with the tutor. */
export interface TutorScenario {
  id: string;
  title: string;
  titleEn: string;
  levels: readonly TutorLevel[];
  setting: string;
  tutorRole: string;
  learnerRole: string;
  formality: 'formal' | 'informal';
  goals: readonly ScenarioGoal[];
  keyVocab: readonly string[];
  grammarFocus: readonly string[];
  opening: string;
  tags: readonly string[];
  /** `eval` scenarios are held out of training; the app may still use them. */
  split: 'train' | 'eval';
}

/** A prompt: the reply pushes the learner to self-correct. */
export interface TutorPrompt {
  learnerText: string;
  errorTags: readonly string[];
}

/** A recast: the reply gives back the corrected form. */
export interface TutorRecast {
  learnerText: string;
  correctedText: string;
  errorTags: readonly string[];
}

/** A lemma above the learner's ceiling that the reply introduces on purpose. */
export interface NewWord {
  lemma: string;
  glossEn: string;
}

/** Cumulative scenario progress. */
export interface ScenarioProgress {
  goalsCompleted: readonly string[];
  done: boolean;
}

/** The structured part of a tutor turn. */
export interface TutorAnnotations {
  prompt: TutorPrompt | null;
  recast: TutorRecast | null;
  newWords: readonly NewWord[];
  scenarioProgress: ScenarioProgress;
}

/** One tutor turn: the Italian reply plus annotations. `reply` is always first on the wire. */
export interface TutorOutput {
  reply: string;
  annotations: TutorAnnotations;
}

/** A recurring learner error, for the system prompt. */
export interface ErrorHistoryItem {
  tag: string;
  count: number;
  lastExample?: string | null;
}

/** What the tutor knows about the learner. */
export interface LearnerProfile {
  level: TutorLevel;
  /** Known-lemma frequency ceiling; defaults to the band's. */
  lemmaCeiling?: number | null;
  /** Unlocked grammar point slugs; empty means all up to the level. */
  knownGrammar?: readonly string[];
  /** At most 5 recurring errors, most important first. */
  errorHistory?: readonly ErrorHistoryItem[];
}

/** Everything the system prompt is rendered from. */
export interface TutorContext {
  learner: LearnerProfile;
  scenario: TutorScenario;
}

/** One dialogue turn; tutor turns carry their structured output. */
export type TutorTurn =
  { role: 'tutor'; text: string; output: TutorOutput } | { role: 'learner'; text: string };

/** A chat message as the model sees it. */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
