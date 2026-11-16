import { sql } from 'drizzle-orm';

import { grammarPoint, lemma, sentence } from '@/db/schema';
import type { AppDatabase } from '@/db/types';

import { createMetaRepo, META_KEYS } from '../MetaRepo';
import { chunk } from '../util';
import { compareSeedVersions, SeedSchema, SeedVersionSchema, type SeedVersion } from './seedSchema';

/** Content table being imported. */
export type SeedTable = 'grammar_point' | 'lemma' | 'sentence';

/** Progress of {@link importSeed}. */
export interface SeedImportProgress {
  /** Rows written so far across all tables. */
  done: number;
  /** Rows to write in total. */
  total: number;
  /** Table of the batch just written. */
  table: SeedTable;
}

/** Options for {@link importSeed}. */
export interface ImportSeedOptions {
  /** Called after each batch. */
  onProgress?: (progress: SeedImportProgress) => void;
  /** Rows per insert statement. Defaults to 500. */
  batchSize?: number;
  /**
   * Awaited between batches so the UI can render progress. Defaults to a
   * macrotask yield. The import holds a write transaction while it runs, so
   * nothing else may use the database until it settles.
   */
  yieldBetweenBatches?: () => Promise<void>;
}

/** Outcome of {@link importSeed}. */
export interface ImportSeedResult {
  /**
   * `imported`: content replaced with this seed; `up-to-date`: this version is
   * already imported; `skipped-older`: a newer version is already imported.
   */
  status: 'imported' | 'up-to-date' | 'skipped-older';
  /** Version of the seed passed in. */
  version: SeedVersion;
  /** Version imported before this call, or null on first import. */
  previousVersion: SeedVersion | null;
  /** Rows written (0 unless imported). */
  rowsWritten: number;
}

const DEFAULT_BATCH_SIZE = 500;

const macrotask = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

function assertUniqueIds(name: string, rows: readonly { id: number }[]): void {
  const seen = new Set<number>();
  for (const { id } of rows) {
    if (seen.has(id)) throw new Error(`Seed has duplicate ${name} id ${String(id)}`);
    seen.add(id);
  }
}

/** The version of the seed currently imported, or null if none. */
export function getImportedSeedVersion(db: AppDatabase): SeedVersion | null {
  const raw = createMetaRepo(db, () => '').get(META_KEYS.seedVersion);
  if (raw === null) return null;
  try {
    const parsed = SeedVersionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Import the bundled content seed (lemmas, sentences, grammar points).
 *
 * Idempotent and versioned: the imported version is stored in device-local
 * metadata. Re-running with the same version is a no-op, an older version is
 * ignored, and a newer version replaces the content tables so they match the
 * seed exactly (rows dropped from the seed are removed). Learner data (cards,
 * review logs, settings and so on) is never touched: cards refer to content by
 * the pipeline's stable ids, without foreign keys, so they survive.
 *
 * The whole import is one write transaction, written in batches, so a failure
 * or crash leaves the previous content and version in place.
 *
 * @param seed - the seed object; validated against the seed schema
 * @throws ZodError when the seed does not match the schema
 * @throws Error when the seed repeats an id within a table
 */
export async function importSeed(
  db: AppDatabase,
  seed: unknown,
  options: ImportSeedOptions = {},
): Promise<ImportSeedResult> {
  const parsed = SeedSchema.parse(seed);
  assertUniqueIds('lemma', parsed.lemmas);
  assertUniqueIds('sentence', parsed.sentences);
  assertUniqueIds('grammar point', parsed.grammarPoints);

  const previousVersion = getImportedSeedVersion(db);
  if (previousVersion !== null) {
    const cmp = compareSeedVersions(parsed.version, previousVersion);
    if (cmp <= 0) {
      return {
        status: cmp === 0 ? 'up-to-date' : 'skipped-older',
        version: parsed.version,
        previousVersion,
        rowsWritten: 0,
      };
    }
  }

  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const pause = options.yieldBetweenBatches ?? macrotask;
  const total = parsed.lemmas.length + parsed.sentences.length + parsed.grammarPoints.length;
  let done = 0;

  const writeAll = async <T>(
    name: SeedTable,
    rows: readonly T[],
    insert: (part: T[]) => void,
  ): Promise<void> => {
    for (const part of chunk(rows, batchSize)) {
      insert(part);
      done += part.length;
      options.onProgress?.({ done, total, table: name });
      await pause();
    }
  };

  db.run(sql`BEGIN IMMEDIATE`);
  try {
    db.delete(sentence).run();
    db.delete(lemma).run();
    db.delete(grammarPoint).run();
    await writeAll('grammar_point', parsed.grammarPoints, (part) => {
      db.insert(grammarPoint).values(part).run();
    });
    await writeAll('lemma', parsed.lemmas, (part) => {
      db.insert(lemma)
        .values(part.map((l) => ({ ...l, audioRef: l.audioRef ?? null })))
        .run();
    });
    await writeAll('sentence', parsed.sentences, (part) => {
      db.insert(sentence).values(part).run();
    });
    const meta = createMetaRepo(db, () => '');
    meta.set(META_KEYS.seedVersion, JSON.stringify(parsed.version));
    meta.set(META_KEYS.seedGeneratedAt, parsed.generatedAt);
    db.run(sql`COMMIT`);
  } catch (error) {
    db.run(sql`ROLLBACK`);
    throw error;
  }

  return { status: 'imported', version: parsed.version, previousVersion, rowsWritten: total };
}
