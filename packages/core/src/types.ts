/**
 * Learner's answer quality for one review, in FSRS terms.
 *
 * - `again`: forgot or answered wrongly
 * - `hard`: recalled with serious difficulty (for example one typo)
 * - `good`: recalled correctly
 * - `easy`: recalled correctly and fast
 */
export type Rating = 'again' | 'hard' | 'good' | 'easy';

/** All ratings, in increasing order of recall quality. */
export const RATINGS: readonly Rating[] = ['again', 'hard', 'good', 'easy'];

/**
 * FSRS learning state of a card. Stored in the `card.state` column.
 */
export type CardState = 'new' | 'learning' | 'review' | 'relearning';

/** All card states. */
export const CARD_STATES: readonly CardState[] = ['new', 'learning', 'review', 'relearning'];

/**
 * The scheduling fields of a card. These map one to one onto the FSRS columns
 * of the `card` table in the app database (camelCase here, snake_case in SQL).
 */
export interface CardSchedule {
  /** When the card is next due. */
  due: Date;
  /** Memory stability in days (the interval at which recall probability is 90%). */
  stability: number;
  /** Item difficulty, 1 (easiest) to 10 (hardest); 0 for a new card. */
  difficulty: number;
  /** Days between the last review and `due` (0 while in learning steps). */
  scheduledDays: number;
  /** Index of the current (re)learning step. */
  learningSteps: number;
  /** Number of reviews so far. */
  reps: number;
  /** Number of times the card was forgotten after graduating to review. */
  lapses: number;
  /** FSRS state. */
  state: CardState;
  /** Time of the most recent review, or null for a new card. */
  lastReview: Date | null;
}

/**
 * What a single review did to a card. Persisted alongside the app's own
 * review log fields (answer, latency, device); the state before the review is
 * kept so a review can be audited or undone.
 */
export interface ReviewOutcomeLog {
  /** Rating given. */
  rating: Rating;
  /** When the review happened. */
  reviewedAt: Date;
  /** Days since the previous review (0 for the first review). */
  elapsedDays: number;
  /** The card's scheduling fields immediately before this review. */
  previous: CardSchedule;
}

/** Result of {@link Scheduler.review}. */
export interface ReviewResult {
  /** The card's scheduling fields after the review. */
  card: CardSchedule;
  /** A log entry describing the review. */
  log: ReviewOutcomeLog;
}

/**
 * Kinds of practice item. Every kind except `minimal_pair` is scheduled by
 * FSRS; minimal pairs (HVPT ear training) use their own adaptive selection.
 */
export type CardKind =
  | 'cloze_production'
  | 'sentence_production'
  | 'dictation'
  | 'grammar_cloze'
  | 'grammar_drill'
  | 'spoken_prompt'
  | 'recognition'
  | 'minimal_pair';

/** All card kinds. */
export const CARD_KINDS: readonly CardKind[] = [
  'cloze_production',
  'sentence_production',
  'dictation',
  'grammar_cloze',
  'grammar_drill',
  'spoken_prompt',
  'recognition',
  'minimal_pair',
];

/** How the learner answers a card: by typing, or by speaking. */
export type PromptMode = 'typed' | 'spoken';

/** All prompt modes. */
export const PROMPT_MODES: readonly PromptMode[] = ['typed', 'spoken'];
