import type { AppDatabase } from '@/db/types';

import { createCardRepo, type CardRepo } from './CardRepo';
import {
  createGrammarRepo,
  createLemmaRepo,
  createSentenceRepo,
  type GrammarRepo,
  type LemmaRepo,
  type SentenceRepo,
} from './contentRepos';
import { createErrorRecordRepo, type ErrorRecordRepo } from './ErrorRecordRepo';
import { newUuid, type IdGenerator } from './ids';
import { createLearnerSentenceRepo, type LearnerSentenceRepo } from './LearnerSentenceRepo';
import { createMetaRepo, type MetaRepo } from './MetaRepo';
import { createModelFileRepo, type ModelFileRepo } from './ModelFileRepo';
import { createReadingRepo, type ReadingRepo } from './ReadingRepo';
import { recordReview, type RecordReviewInput } from './recordReview';
import { createReviewLogRepo, type ReviewLogRepo } from './ReviewLogRepo';
import type { ReviewLogRow } from './rows';
import { createSettingsRepo, type SettingsRepo } from './SettingsRepo';
import { createStoryRepo, type StoryRepo } from './StoryRepo';
import { createStreakRepo, type StreakRepo } from './StreakRepo';
import { createStudySessionRepo, type StudySessionRepo } from './StudySessionRepo';

/** Every repository over one database, plus the services built on them. */
export interface Repositories {
  lemmas: LemmaRepo;
  sentences: SentenceRepo;
  grammar: GrammarRepo;
  cards: CardRepo;
  reviewLogs: ReviewLogRepo;
  stories: StoryRepo;
  /** Reading progress and words met in stories. */
  reading: ReadingRepo;
  errors: ErrorRecordRepo;
  /** Sentences corrected in conversation. */
  learnerSentences: LearnerSentenceRepo;
  studySessions: StudySessionRepo;
  settings: SettingsRepo;
  streak: StreakRepo;
  meta: MetaRepo;
  /** Install state of on-device model files. */
  modelFiles: ModelFileRepo;
  /** {@link recordReview} bound to this database. */
  recordReview(input: RecordReviewInput): ReviewLogRow;
}

/** Options for {@link createRepositories}. */
export interface RepositoryOptions {
  /** Id generator for new rows; defaults to random UUIDs. */
  newId?: IdGenerator;
}

/** Create all repositories over `db`. */
export function createRepositories(db: AppDatabase, options: RepositoryOptions = {}): Repositories {
  const newId = options.newId ?? newUuid;
  return {
    lemmas: createLemmaRepo(db),
    sentences: createSentenceRepo(db),
    grammar: createGrammarRepo(db),
    cards: createCardRepo(db),
    reviewLogs: createReviewLogRepo(db, newId),
    stories: createStoryRepo(db, newId),
    reading: createReadingRepo(db),
    errors: createErrorRecordRepo(db, newId),
    learnerSentences: createLearnerSentenceRepo(db),
    studySessions: createStudySessionRepo(db, newId),
    settings: createSettingsRepo(db),
    streak: createStreakRepo(db),
    meta: createMetaRepo(db, newId),
    modelFiles: createModelFileRepo(db),
    recordReview: (input) => recordReview(db, input, newId),
  };
}
