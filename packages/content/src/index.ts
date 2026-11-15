/**
 * `@italia/content`: the content seed's schema and loader.
 *
 * The seed itself is `@italia/content/seed.v1.json`, built by
 * `pnpm --filter @italia/content build:seed`. Validate it with {@link parseSeed}
 * and insert the rows from {@link toRows}.
 *
 * @packageDocumentation
 */

export {
  SEED_VERSION,
  SeedGrammarPointSchema,
  SeedLemmaSchema,
  SeedSchema,
  SeedSentenceSchema,
  SeedSourceSchema,
  SeedTokenSchema,
  type Seed,
  type SeedGrammarPoint,
  type SeedLemma,
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
