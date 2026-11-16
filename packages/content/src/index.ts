/**
 * `@italia/content`: the content seed's schema and loader.
 *
 * The seed itself is `@italia/content/seed.v1.json`, built by
 * `pnpm --filter @italia/content build:seed`. Validate it with {@link parseSeed}
 * and insert the rows from {@link toRows}.
 *
 * The graded stories are `@italia/content/stories.v1.json`, built by
 * `pnpm --filter @italia/content build:stories`. Validate them with
 * {@link parseStoriesFile} and map each story to a `story` row with
 * {@link toStoryRow}.
 *
 * @packageDocumentation
 */

export {
  SEED_VERSION,
  SeedGrammarPointSchema,
  SeedLemmaSchema,
  SeedManifestFileSchema,
  SeedManifestSchema,
  SeedSchema,
  SeedSentenceSchema,
  SeedSourceSchema,
  SeedTokenSchema,
  type Seed,
  type SeedGrammarPoint,
  type SeedLemma,
  type SeedManifest,
  type SeedManifestFile,
  type SeedSentence,
  type SeedSource,
  type SeedToken,
} from './schema';
export { parseSeed, toRows, type GrammarPointRow, type LemmaRow, type SentenceRow } from './loader';
export { UPOS, type Upos } from './pipeline/lexicon';
export { GRAMMAR_POINTS, type GrammarCefr, type GrammarPointSource } from './grammar/points';
export {
  BAND_RULES,
  bandRules,
  STORY_BANDS,
  STORY_LEVELS,
  type BandRules,
  type StoryBand,
  type StoryLevel,
} from './stories/bands';
export {
  STORIES_VERSION,
  StoriesFileSchema,
  StoryIndexEntrySchema,
  StoryIndexSchema,
  StoryParagraphSchema,
  StoryQuestionSchema,
  StorySchema,
  StorySentenceSchema,
  StorySeriesSchema,
  StoryTokenSchema,
  StoryWordTimingsSchema,
  type StoriesFile,
  type Story,
  type StoryIndex,
  type StoryIndexEntry,
  type StoryParagraph,
  type StoryQuestion,
  type StorySentence,
  type StorySeries,
  type StoryToken,
  type StoryWordTimings,
} from './stories/schema';
export { parseStoriesFile, toStoryRow, type StoryBody, type StoryRow } from './stories/loader';
export {
  parseStorySource,
  type StorySource,
  type StorySourceQuestion,
  type StorySourceSentence,
} from './stories/source';
export {
  createLemmaResolver,
  createStoryTagger,
  parseVariantSpellings,
  tokenLemmaIds,
  type StoryLemma,
  type StoryPlacement,
  type StoryTaggerInput,
  type TaggedStory,
} from './stories/tagger';
export {
  MAX_NAME_SHARE,
  MIN_IN_BAND,
  MIN_TARGETS,
  QUESTIONS_PER_STORY,
  validateCorpus,
  validateStory,
  type StoryReport,
} from './stories/validate';
