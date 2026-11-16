/**
 * Maps the canonical content seed (`@italia/content`) onto the app's content
 * tables. The seed's schema is owned by `@italia/content`; this module only
 * decides which of its fields the app stores and how.
 */
import { z } from 'zod';

import type { Seed, SeedSentence } from '@italia/content';

import type { SentenceToken } from '@/db/schema';

import type { NewGrammarPoint, NewLemma, NewSentence } from '../rows';

/**
 * Seed version: a whole number or a dotted version string. Versions are
 * compared with {@link compareSeedVersions}.
 */
export const SeedVersionSchema = z.union([z.number().int().nonnegative(), z.string().min(1)]);

/** A seed version. */
export type SeedVersion = z.infer<typeof SeedVersionSchema>;

/** An insert row whose (pipeline-assigned) id is required. */
type WithId<T> = T & { id: number };

/**
 * Content ready to write to the `lemma`, `sentence` and `grammar_point`
 * tables, with the identity of the seed it came from.
 */
export interface SeedContent {
  /** Seed format version. */
  version: SeedVersion;
  /** When the content last changed (ISO 8601); orders seeds of the same version. */
  generatedAt: string;
  lemmas: WithId<NewLemma>[];
  sentences: WithId<NewSentence>[];
  grammarPoints: WithId<NewGrammarPoint>[];
}

/**
 * A sentence's tokens with each lemma index (into `lemmaIds`, as the seed
 * writes them) resolved to a lemma id, the format of `sentence.tokens`.
 */
export function resolveTokens(s: Pick<SeedSentence, 'lemmaIds' | 'extra'>): SentenceToken[] {
  return s.extra.tokens.map(([start, end, ...indexes]) => [
    start,
    end,
    ...indexes.flatMap((i) => {
      const id = s.lemmaIds[i];
      return id === undefined ? [] : [id];
    }),
  ]);
}

/**
 * The app's rows for a validated seed.
 *
 * Stored from `extra`: sentence tokens (cloze blanks and grammar cloze need
 * them). Not stored, because nothing in the app reads them yet: noun gender,
 * frequency per million, sentence target, difficulty and attribution, and the
 * grammar slug and CEFR band. Add a column (and map it here) when a feature
 * needs one of them.
 */
export function seedToContent(seed: Seed): SeedContent {
  return {
    version: seed.version,
    generatedAt: seed.generatedAt,
    lemmas: seed.lemmas.map(({ extra: _extra, ...row }) => row),
    sentences: seed.sentences.map(({ extra, ...row }) => ({
      ...row,
      tokens: resolveTokens({ lemmaIds: row.lemmaIds, extra }),
    })),
    grammarPoints: seed.grammarPoints.map(({ extra: _extra, ...row }) => row),
  };
}

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

/** Identity of an imported or bundled seed. */
export interface SeedIdentity {
  version: SeedVersion;
  generatedAt: string | null;
}

/**
 * Compare two seeds: by version, then by `generatedAt` (a missing or
 * unparsable time sorts first). Negative when `a` is older than `b`.
 */
export function compareSeeds(a: SeedIdentity, b: SeedIdentity): number {
  const byVersion = compareSeedVersions(a.version, b.version);
  if (byVersion !== 0) return byVersion;
  const time = (s: string | null) => {
    const ms = s === null ? Number.NaN : Date.parse(s);
    return Number.isNaN(ms) ? -Infinity : ms;
  };
  const ta = time(a.generatedAt);
  const tb = time(b.generatedAt);
  return ta === tb ? 0 : ta < tb ? -1 : 1;
}
