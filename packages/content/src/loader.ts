import {
  type Seed,
  type SeedGrammarPoint,
  type SeedLemma,
  SeedSchema,
  type SeedSentence,
} from './schema';

/** A `lemma` table insert row (the seed row without `extra`). */
export type LemmaRow = Omit<SeedLemma, 'extra'>;
/** A `sentence` table insert row (the seed row without `extra`). */
export type SentenceRow = Omit<SeedSentence, 'extra'>;
/** A `grammar_point` table insert row (the seed row without `extra`). */
export type GrammarPointRow = Omit<SeedGrammarPoint, 'extra'>;

/**
 * Validate parsed seed JSON (for example the result of
 * `require('@italia/content/seed.v1.json')`). Throws a `ZodError` when the data
 * does not match {@link SeedSchema}.
 */
export function parseSeed(data: unknown): Seed {
  return SeedSchema.parse(data);
}

/** Rows ready to insert into the app's content tables (drops each row's `extra`). */
export function toRows(seed: Seed): {
  lemmas: LemmaRow[];
  sentences: SentenceRow[];
  grammarPoints: GrammarPointRow[];
} {
  return {
    lemmas: seed.lemmas.map(({ extra: _extra, ...row }) => row),
    sentences: seed.sentences.map(({ extra: _extra, ...row }) => row),
    grammarPoints: seed.grammarPoints.map(({ extra: _extra, ...row }) => row),
  };
}
