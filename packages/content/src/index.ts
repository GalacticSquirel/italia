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
  buildClipPack,
  CLIP_PACK_VERSION,
  ClipPackSchema,
  ClipSchema,
  parseCommonVoiceTsv,
  selectClips,
  sentenceWords,
  type Clip,
  type ClipPack,
  type ClipSelection,
  type ClipTarget,
  type CommonVoiceRow,
  type PackFile,
  type SelectOptions,
  type WordTiming,
} from './clips/clipPack';
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
  type StorySentence,
  type StorySeries,
  type StoryToken,
  type StoryWordTimings,
} from './stories/schema';
export { parseStoriesFile, toStoryRow, type StoryBody, type StoryRow } from './stories/loader';
export { parseStorySource, type StorySource, type StorySourceSentence } from './stories/source';
export {
  createLemmaResolver,
  createStoryTagger,
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
  validateCorpus,
  validateStory,
  type StoryReport,
} from './stories/validate';
