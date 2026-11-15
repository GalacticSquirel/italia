/**
 * Row types for every table, inferred from the Drizzle schema. Repositories
 * return these so screens never depend on Drizzle directly.
 */
import type {
  appMeta,
  card,
  errorRecord,
  grammarPoint,
  learnerSentence,
  lemma,
  reviewLog,
  sentence,
  settings,
  story,
  streakState,
  studySession,
} from '@/db/schema';

/** A lemma (dictionary word) from the seed. */
export type LemmaRow = typeof lemma.$inferSelect;
/** Insert shape of a lemma. */
export type NewLemma = typeof lemma.$inferInsert;
/** A sentence pair from the seed. */
export type SentenceRow = typeof sentence.$inferSelect;
/** Insert shape of a sentence. */
export type NewSentence = typeof sentence.$inferInsert;
/** A grammar point from the seed. */
export type GrammarPointRow = typeof grammarPoint.$inferSelect;
/** Insert shape of a grammar point. */
export type NewGrammarPoint = typeof grammarPoint.$inferInsert;
/** A practice card with its FSRS state. */
export type CardRow = typeof card.$inferSelect;
/** Insert shape of a card. */
export type NewCardRow = typeof card.$inferInsert;
/** One immutable review. */
export type ReviewLogRow = typeof reviewLog.$inferSelect;
/** Insert shape of a review log row. */
export type NewReviewLogRow = typeof reviewLog.$inferInsert;
/** A graded story. */
export type StoryRow = typeof story.$inferSelect;
/** Insert shape of a story. */
export type NewStoryRow = typeof story.$inferInsert;
/** A recorded learner error. */
export type ErrorRecordRow = typeof errorRecord.$inferSelect;
/** A study session. */
export type StudySessionRow = typeof studySession.$inferSelect;
/** A raw settings row (JSON value). */
export type SettingsRow = typeof settings.$inferSelect;
/** The raw streak row. */
export type StreakStateRow = typeof streakState.$inferSelect;
/** A device-local metadata row. */
export type AppMetaRow = typeof appMeta.$inferSelect;
/** A sentence the learner corrected in conversation. */
export type LearnerSentenceRow = typeof learnerSentence.$inferSelect;
