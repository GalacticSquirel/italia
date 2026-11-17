/**
 * Zod schema for graded stories (`stories/<series>/<nn>.json` and the bundled
 * `seed/stories.v1.json`). Stories are original text written for the project and
 * tagged against the seed's lemma ids, so the app can compute coverage against
 * the learner's known words.
 */
import { z } from 'zod';

import { STORY_BANDS, STORY_LEVELS } from './bands';

/** Stories file format version. Bump when the shape changes incompatibly. */
export const STORIES_VERSION = 1;

const lemmaIdSchema = z.number().int().positive().max(2_147_483_647);
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

/**
 * One word token of a sentence's `it` text. Offsets are UTF-16, end exclusive,
 * and `text` is exactly `it.slice(start, end)`; punctuation is not tokenised.
 * Elided forms are separate tokens: "l'acqua" is "l'" + "acqua", "c'è" is
 * "c'" (ci) + "è" (essere).
 */
export const StoryTokenSchema = z
  .object({
    text: z.string().min(1),
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
    /**
     * Seed lemma id of the word (the head lemma for a contracted form: "nel" is
     * `in`, "dimmi" is `dire`). Null for names and for words outside the seed.
     */
    lemmaId: lemmaIdSchema.nullable(),
    /**
     * Further lemmas packed into the same token, in order: the article of an
     * articulated preposition ("nel" -> il) or enclitic pronouns ("dimmi" -> mi,
     * "alzarsi" -> si). Omitted when there are none.
     */
    partIds: z.array(lemmaIdSchema).min(1).optional(),
    /** A proper noun (character or place name); not counted for coverage. */
    isName: z.literal(true).optional(),
  })
  .strict()
  .refine((t) => t.end > t.start && t.end - t.start === t.text.length, {
    message: 'token offsets do not match its text',
  })
  .refine((t) => !(t.isName && t.lemmaId !== null), { message: 'a name has no lemma id' });

export const StorySentenceSchema = z
  .object({
    it: z.string().min(1),
    /** Faithful, natural English translation of this sentence. */
    en: z.string().min(1),
    tokens: z.array(StoryTokenSchema).min(1),
    /** Grammar point ids the detection rules find in this sentence, sorted. */
    grammarIds: z.array(z.number().int().positive()),
  })
  .strict()
  .superRefine((s, ctx) => {
    let last = 0;
    for (const t of s.tokens) {
      if (s.it.slice(t.start, t.end) !== t.text) {
        ctx.addIssue({ code: 'custom', message: `token "${t.text}" does not match "${s.it}"` });
      }
      if (t.start < last) ctx.addIssue({ code: 'custom', message: `tokens overlap in "${s.it}"` });
      last = t.end;
    }
  });

export const StoryParagraphSchema = z
  .object({ sentences: z.array(StorySentenceSchema).min(1) })
  .strict();

/**
 * A multiple-choice comprehension question. The prompt and each option are
 * tagged like story sentences, so the reader can offer tap-to-translate on them.
 * Options are stored in authored order; the app shuffles them.
 */
export const StoryQuestionSchema = z
  .object({
    prompt: StorySentenceSchema,
    options: z.array(StorySentenceSchema).min(2).max(4),
    /** Index of the correct option in `options`. */
    answer: z.number().int().nonnegative(),
  })
  .strict()
  .refine((q) => q.answer < q.options.length, { message: 'answer is not one of the options' });

/** A bundled graded story. */
export const StorySchema = z
  .object({
    /** Stable slug, `<seriesId>-<nn>`, e.g. `la-casa-di-luca-01`. Never reused. */
    id: slug,
    seriesId: slug,
    /** Position within the series, starting at 1. */
    seriesIndex: z.number().int().positive(),
    /** CEFR level of the band (matches the `story.level` column). */
    level: z.enum(STORY_LEVELS),
    /** Lemma-rank ceiling the story is written to, see `BAND_RULES`. */
    band: z.union(STORY_BANDS.map((b) => z.literal(b))),
    title: z.object({ it: z.string().min(1), en: z.string().min(1) }).strict(),
    paragraphs: z.array(StoryParagraphSchema).min(1),
    /**
     * New words this story is meant to teach: content lemmas above the previous
     * band's ceiling that the story repeats (most repeated first).
     */
    targetLemmaIds: z.array(lemmaIdSchema),
    /** Grammar point ids used anywhere in the story text, sorted. */
    grammarIds: z.array(z.number().int().positive()),
    /** Comprehension questions on the story, in story order. */
    questions: z.array(StoryQuestionSchema).default([]),
    /** Number of word tokens of the story text (questions excluded), names included. */
    wordCount: z.number().int().positive(),
  })
  .strict()
  .superRefine((s, ctx) => {
    if (s.id !== `${s.seriesId}-${String(s.seriesIndex).padStart(2, '0')}`) {
      ctx.addIssue({ code: 'custom', message: `id ${s.id} must be <seriesId>-<nn>` });
    }
    const words = s.paragraphs.reduce(
      (n, p) => n + p.sentences.reduce((m, x) => m + x.tokens.length, 0),
      0,
    );
    if (words !== s.wordCount) {
      ctx.addIssue({ code: 'custom', message: `wordCount ${s.wordCount} != ${words} tokens` });
    }
  });

/**
 * Per-token audio timings, filled in by the audio phase and stored in the
 * `story.word_timings` column (not part of the story files yet). One entry per
 * sentence in reading order (paragraphs flattened); each holds one
 * `[startMs, endMs]` pair per token of that sentence, offsets from the start of
 * the story's audio file (`story.audio_ref`).
 */
export const StoryWordTimingsSchema = z.array(
  z.array(z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()])),
);

/** One entry of `stories/index.json`. */
export const StoryIndexEntrySchema = z
  .object({
    id: slug,
    seriesId: slug,
    seriesIndex: z.number().int().positive(),
    band: z.union(STORY_BANDS.map((b) => z.literal(b))),
    level: z.enum(STORY_LEVELS),
    title: z.object({ it: z.string().min(1), en: z.string().min(1) }).strict(),
    wordCount: z.number().int().positive(),
    /** Path of the story file relative to `stories/`. */
    file: z.string().regex(/^[a-z0-9-]+\/\d{2}\.json$/),
  })
  .strict();

/** A series of episodes with a recurring cast. */
export const StorySeriesSchema = z
  .object({
    id: slug,
    title: z.object({ it: z.string().min(1), en: z.string().min(1) }).strict(),
    band: z.union(STORY_BANDS.map((b) => z.literal(b))),
    /** One line on the premise, for the library screen. */
    blurb: z.string().min(1),
  })
  .strict();

/** `stories/index.json`: every committed story, in band then series order. */
export const StoryIndexSchema = z
  .object({
    version: z.literal(STORIES_VERSION),
    series: z.array(StorySeriesSchema).min(1),
    stories: z.array(StoryIndexEntrySchema).min(1),
  })
  .strict();

/** `seed/stories.v1.json`: the bundled corpus the app imports. */
export const StoriesFileSchema = z
  .object({
    version: z.literal(STORIES_VERSION),
    /** sha256 of the `seed.v1.json` the lemma ids were tagged against. */
    seedSha256: z.string().regex(/^[0-9a-f]{64}$/),
    series: z.array(StorySeriesSchema).min(1),
    stories: z.array(StorySchema).min(1),
  })
  .strict();

export type StoryToken = z.infer<typeof StoryTokenSchema>;
export type StorySentence = z.infer<typeof StorySentenceSchema>;
export type StoryParagraph = z.infer<typeof StoryParagraphSchema>;
export type StoryQuestion = z.infer<typeof StoryQuestionSchema>;
export type Story = z.infer<typeof StorySchema>;
export type StoryWordTimings = z.infer<typeof StoryWordTimingsSchema>;
export type StoryIndexEntry = z.infer<typeof StoryIndexEntrySchema>;
export type StorySeries = z.infer<typeof StorySeriesSchema>;
export type StoryIndex = z.infer<typeof StoryIndexSchema>;
export type StoriesFile = z.infer<typeof StoriesFileSchema>;
