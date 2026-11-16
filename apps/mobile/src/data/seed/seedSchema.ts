import { z } from 'zod';

// TODO(content): replace this local schema with the canonical seed schema exported by
// `@italia/content` once that package publishes it. Field names here match the Drizzle insert
// types of `lemma`, `sentence` and `grammar_point` in `@/db/schema`.

const id = z.number().int().nonnegative();
const idList = z.array(id);

/** A lemma row in the seed. */
export const SeedLemmaSchema = z.object({
  id,
  lemma: z.string().min(1),
  pos: z.string().min(1),
  freqRank: z.number().int().positive(),
  glossEn: z.string(),
  audioRef: z.string().nullable().optional(),
});

/** A sentence row in the seed. */
export const SeedSentenceSchema = z.object({
  id,
  it: z.string().min(1),
  en: z.string().min(1),
  lemmaIds: idList,
  grammarIds: idList,
  source: z.string().min(1),
  licence: z.string().min(1),
});

/** A grammar point row in the seed. */
export const SeedGrammarPointSchema = z.object({
  id,
  title: z.string().min(1),
  order: z.number().int(),
  prerequisiteIds: idList,
  noteMd: z.string(),
});

/**
 * Seed version: a whole number or a dotted version string. Versions are
 * compared with {@link compareSeedVersions}.
 */
export const SeedVersionSchema = z.union([z.number().int().nonnegative(), z.string().min(1)]);

/** The bundled content seed produced by the content pipeline. */
export const SeedSchema = z.object({
  version: SeedVersionSchema,
  generatedAt: z.string(),
  /** Content sources and their licences; not stored on the device. */
  sources: z.array(z.unknown()),
  lemmas: z.array(SeedLemmaSchema),
  sentences: z.array(SeedSentenceSchema),
  grammarPoints: z.array(SeedGrammarPointSchema),
});

/** A validated content seed. */
export type Seed = z.infer<typeof SeedSchema>;

/** A seed version. */
export type SeedVersion = z.infer<typeof SeedVersionSchema>;

/**
 * Compare two seed versions: negative when `a` is older than `b`, 0 when
 * equal, positive when newer. Numbers and strings are compared as dotted
 * numeric versions ("2" < "10", "1.2" < "1.10").
 */
export function compareSeedVersions(a: SeedVersion, b: SeedVersion): number {
  const pa = String(a).split('.');
  const pb = String(b).split('.');
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? '0';
    const y = pb[i] ?? '0';
    const nx = /^\d+$/.test(x) ? Number(x) : Number.NaN;
    const ny = /^\d+$/.test(y) ? Number(y) : Number.NaN;
    if (!Number.isNaN(nx) && !Number.isNaN(ny)) {
      if (nx !== ny) return nx - ny;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}
