import { z } from 'zod';

import { UPOS } from './pipeline/lexicon';

/** Seed format version. Bump when the shape changes incompatibly. */
export const SEED_VERSION = 1;

const id = z.number().int().positive().max(2_147_483_647);

/** One upstream file the seed was built from. */
export const SeedSourceSchema = z
  .object({
    /** Stable key, e.g. `tatoeba-ita`. */
    id: z.string().min(1),
    name: z.string().min(1),
    url: z.url(),
    homepage: z.url(),
    /** SPDX-style licence expression. */
    licence: z.string().min(1),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    bytes: z.number().int().nonnegative(),
    /** When this exact file was first downloaded (ISO 8601). */
    fetchedAt: z.iso.datetime(),
    /** What the pipeline used it for. */
    usedFor: z.string().min(1),
  })
  .strict();

/**
 * A `lemma` row. The fields other than `extra` match the insert type of the
 * `lemma` table in `apps/mobile/src/db/schema.ts`.
 */
export const SeedLemmaSchema = z
  .object({
    /** Stable id: a hash of `lemma|pos`, so it never changes between builds. */
    id,
    lemma: z.string().min(1),
    /** Universal POS tag. */
    pos: z.enum(UPOS),
    /** 1 = most frequent. */
    freqRank: z.number().int().positive(),
    glossEn: z.string().min(1),
    audioRef: z.string().nullable(),
    /** Fields the table does not have (yet). */
    extra: z
      .object({
        /** Grammatical gender of nouns. */
        gender: z.enum(['m', 'f']).optional(),
        /** Occurrences per million tokens in the subtitle frequency list. */
        perMillion: z.number().nonnegative(),
      })
      .strict(),
  })
  .strict();

/**
 * A word token of `it`: `[start, end, ...lemmaIndexes]`. Offsets are UTF-16, end
 * exclusive; each index points into the sentence's `lemmaIds` (an articulated
 * preposition such as "nel" has two). Proper nouns have no indexes.
 */
export const SeedTokenSchema = z
  .tuple([z.number().int().nonnegative(), z.number().int().positive()])
  .rest(z.number().int().nonnegative());

/**
 * A `sentence` row. The fields other than `extra` match the insert type of the
 * `sentence` table.
 */
export const SeedSentenceSchema = z
  .object({
    /** The Tatoeba id of the Italian sentence. */
    id,
    it: z.string().min(1),
    en: z.string().min(1),
    /** Distinct lemma ids in order of first appearance. */
    lemmaIds: z.array(id).min(1),
    grammarIds: z.array(id),
    /** e.g. `tatoeba:12345` (the Italian sentence). */
    source: z.string().regex(/^tatoeba:\d+$/),
    licence: z.literal('CC-BY-2.0-FR'),
    extra: z
      .object({
        /** The lemma this sentence was chosen to teach. */
        targetLemmaId: id,
        /** Highest `freqRank` among the sentence's lemmas. */
        difficulty: z.number().int().positive(),
        /** True when the target is the rarest lemma (an n+1 sentence). */
        anchor: z.boolean(),
        /** Word tokens, see `SeedTokenSchema`. */
        tokens: z.array(SeedTokenSchema).min(1),
        /** Tatoeba id of the English translation. */
        enSentenceId: id,
        /** Tatoeba usernames, for attribution (null when the account was deleted). */
        itAuthor: z.string().nullable(),
        enAuthor: z.string().nullable(),
      })
      .strict(),
  })
  .strict()
  .superRefine((s, ctx) => {
    for (const [start, end, ...indexes] of s.extra.tokens) {
      if (end > s.it.length || start >= end) {
        ctx.addIssue({ code: 'custom', message: `token ${start}-${end} outside sentence ${s.id}` });
      }
      if (indexes.some((i) => i >= s.lemmaIds.length)) {
        ctx.addIssue({ code: 'custom', message: `token lemma index out of range in ${s.id}` });
      }
    }
    if (!s.lemmaIds.includes(s.extra.targetLemmaId)) {
      ctx.addIssue({ code: 'custom', message: `target lemma not in sentence ${s.id}` });
    }
  });

/**
 * A `grammar_point` row. The fields other than `extra` match the insert type of
 * the `grammar_point` table.
 */
export const SeedGrammarPointSchema = z
  .object({
    id,
    title: z.string().min(1),
    /** Acquisition order; lower is taught first. */
    order: z.number().int().positive(),
    prerequisiteIds: z.array(id),
    noteMd: z.string().min(1),
    extra: z
      .object({
        slug: z.string().regex(/^[a-z0-9-]+$/),
        cefr: z.enum(['A1', 'A2', 'B1']),
      })
      .strict(),
  })
  .strict();

/** The whole seed file (`seed/seed.v1.json`). */
export const SeedSchema = z
  .object({
    version: z.literal(SEED_VERSION),
    /** When the content last changed (kept stable across no-op rebuilds). */
    generatedAt: z.iso.datetime(),
    sources: z.array(SeedSourceSchema).min(1),
    lemmas: z.array(SeedLemmaSchema).min(1),
    sentences: z.array(SeedSentenceSchema),
    grammarPoints: z.array(SeedGrammarPointSchema).min(1),
  })
  .strict();

export type SeedSource = z.infer<typeof SeedSourceSchema>;
export type SeedLemma = z.infer<typeof SeedLemmaSchema>;
export type SeedToken = z.infer<typeof SeedTokenSchema>;
export type SeedSentence = z.infer<typeof SeedSentenceSchema>;
export type SeedGrammarPoint = z.infer<typeof SeedGrammarPointSchema>;
export type Seed = z.infer<typeof SeedSchema>;
