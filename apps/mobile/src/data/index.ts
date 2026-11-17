/**
 * Local persistence layer: typed repositories over the app database, seed
 * import, and backup/restore. Screens use these instead of Drizzle directly.
 */
export { addToReviews, type AddToReviewsResult } from './addToReviews';
export {
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  BackupFileSchema,
  type BackupFile,
} from './backup/backupSchema';
export {
  exportBackup,
  importBackup,
  parseBackup,
  UnsupportedBackupVersionError,
  type ImportBackupOptions,
  type ImportBackupResult,
  type ImportStrategy,
} from './backup/backup';
export {
  CardNotFoundError,
  createCardRepo,
  toSchedule,
  type CardCounts,
  type CardRepo,
  type NewCardInput,
} from './CardRepo';
export {
  createGrammarRepo,
  createLemmaRepo,
  createSentenceRepo,
  type GrammarRepo,
  type LemmaRepo,
  type Page,
  type SentenceRepo,
} from './contentRepos';
export {
  createErrorRecordRepo,
  type AddErrorInput,
  type ErrorRecordRepo,
  type ErrorSource,
} from './ErrorRecordRepo';
export { cardIdFor, newUuid, type IdGenerator } from './ids';
export { createMetaRepo, META_KEYS, type MetaKey, type MetaRepo } from './MetaRepo';
export {
  createModelFileRepo,
  type ModelFileRepo,
  type ModelFileRow,
  type ModelFileStatus,
} from './ModelFileRepo';
export {
  createReadingRepo,
  type ReadingRepo,
  type ReadingTotals,
  type StoryReading,
} from './ReadingRepo';
export { recordReview, type RecordReviewInput } from './recordReview';
export { createRepositories, type Repositories, type RepositoryOptions } from './repositories';
export {
  createReviewLogRepo,
  type AppendReviewInput,
  type ReviewLogCursor,
  type ReviewLogPage,
  type ReviewLogRepo,
} from './ReviewLogRepo';
export type * from './rows';
export { ensureSeed, type EnsureSeedResult } from './seed/ensureSeed';
export {
  getImportedSeed,
  getImportedSeedVersion,
  importSeed,
  importSeedContent,
  type ImportSeedOptions,
  type ImportSeedResult,
  type SeedImportProgress,
  type SeedTable,
} from './seed/importSeed';
export { bundledSeedLoader, type SeedLoader } from './seed/seedLoader';
export {
  compareSeeds,
  compareSeedVersions,
  resolveTokens,
  seedToContent,
  type SeedContent,
  type SeedIdentity,
  type SeedVersion,
} from './seed/seedContent';
export {
  createSettingsRepo,
  defaultSettings,
  isSettingKey,
  parseSetting,
  SETTING_KEYS,
  SETTINGS_SCHEMA,
  type SettingKey,
  type Settings,
  type SettingsRepo,
} from './SettingsRepo';
export { ensureStories, type EnsureStoriesResult } from './stories/ensureStories';
export {
  getImportedStories,
  importStories,
  storiesIdentity,
  storyRowsFromFile,
  type ImportStoriesResult,
  type StoriesIdentity,
} from './stories/importStories';
export { bundledStoriesLoader, type StoriesLoader } from './stories/storiesLoader';
export {
  STORY_BODY_FORMAT,
  storyBodyOf,
  type StoredSeries,
  type StoredStoryBody,
  type StoryParagraph,
  type StorySentence,
} from './stories/storyBody';
export { createStoryRepo, type CefrLevel, type SaveStoryInput, type StoryRepo } from './StoryRepo';
export { createStreakRepo, EMPTY_STREAK, type StreakRepo, type StreakSnapshot } from './StreakRepo';
export {
  createStudySessionRepo,
  StudySessionNotActiveError,
  type StudySessionRepo,
} from './StudySessionRepo';
