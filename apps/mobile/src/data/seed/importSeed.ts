import { sql } from 'drizzle-orm';

import { parseSeed } from '@italia/content';

import { grammarPoint, lemma, sentence } from '@/db/schema';
import type { AppDatabase } from '@/db/types';

import { createMetaRepo, META_KEYS } from '../MetaRepo';
import { chunk } from '../util';
import {
  compareSeeds,
  seedToContent,
  SeedVersionSchema,
  type SeedContent,
  type SeedIdentity,
  type SeedVersion,
} from './seedContent';

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
  /** Rows written between progress reports (and UI yields). Defaults to 500. */
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
  return getImportedSeed(db)?.version ?? null;
}

/** Version and generation time of the seed currently imported, or null if none. */
export function getImportedSeed(db: AppDatabase): SeedIdentity | null {
  const meta = createMetaRepo(db, () => '');
  const raw = meta.get(META_KEYS.seedVersion);
  if (raw === null) return null;
  try {
    const parsed = SeedVersionSchema.safeParse(JSON.parse(raw));
    return parsed.success
      ? { version: parsed.data, generatedAt: meta.get(META_KEYS.seedGeneratedAt) }
      : null;
  } catch {
    return null;
  }
}

/**
 * Import the bundled content seed (lemmas, sentences, grammar points).
 *
 * Validates `seed` against the canonical schema from `@italia/content`, maps it
 * to the app's rows with {@link seedToContent} and writes it with
 * {@link importSeedContent}.
 *
 * @param seed - parsed seed JSON
 * @throws ZodError when the seed does not match the schema
 * @throws Error when the seed repeats an id within a table
 */
export async function importSeed(
  db: AppDatabase,
  seed: unknown,
  options: ImportSeedOptions = {},
): Promise<ImportSeedResult> {
  return importSeedContent(db, seedToContent(parseSeed(seed)), options);
}

/**
 * Write mapped seed content to the content tables.
 *
 * Idempotent and versioned: the imported version and generation time are
 * stored in device-local metadata. Re-running with the same seed is a no-op,
 * an older seed is ignored, and a newer one (higher version, or the same
 * version generated later) replaces the content tables so they match it
 * exactly (rows dropped from the seed are removed). Learner data (cards,
 * review logs, settings and so on) is never touched: cards refer to content
 * by the pipeline's stable ids, without foreign keys, so they survive.
 *
 * The whole import is one write transaction, written in batches, so a failure
 * or crash leaves the previous content and version in place.
 *
 * @throws Error when the content repeats an id within a table
 */
export async function importSeedContent(
  db: AppDatabase,
  content: SeedContent,
  options: ImportSeedOptions = {},
): Promise<ImportSeedResult> {
  assertUniqueIds('lemma', content.lemmas);
  assertUniqueIds('sentence', content.sentences);
  assertUniqueIds('grammar point', content.grammarPoints);

  const previous = getImportedSeed(db);
  const previousVersion = previous?.version ?? null;
  if (previous !== null) {
    const cmp = compareSeeds(content, previous);
    if (cmp <= 0) {
      return {
        status: cmp === 0 ? 'up-to-date' : 'skipped-older',
        version: content.version,
        previousVersion,
        rowsWritten: 0,
      };
    }
  }

  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const pause = options.yieldBetweenBatches ?? macrotask;
  const total = content.lemmas.length + content.sentences.length + content.grammarPoints.length;
  let done = 0;

  const writeAll = async <T>(
    name: SeedTable,
    rows: readonly T[],
    insert: (row: T) => void,
  ): Promise<void> => {
    for (const part of chunk(rows, batchSize)) {
      for (const row of part) insert(row);
      done += part.length;
      options.onProgress?.({ done, total, table: name });
      await pause();
    }
  };

  // One prepared statement per table, run once per row: several times faster
  // than building multi-row INSERTs, and the same on both SQLite drivers.
  const p = sql.placeholder;
  const insertGrammar = db
    .insert(grammarPoint)
    .values({
      id: p('id'),
      title: p('title'),
      order: p('order'),
      prerequisiteIds: p('prerequisiteIds'),
      noteMd: p('noteMd'),
    })
    .prepare();
  const insertLemma = db
    .insert(lemma)
    .values({
      id: p('id'),
      lemma: p('lemma'),
      pos: p('pos'),
      freqRank: p('freqRank'),
      glossEn: p('glossEn'),
      audioRef: p('audioRef'),
    })
    .prepare();
  const insertSentence = db
    .insert(sentence)
    .values({
      id: p('id'),
      it: p('it'),
      en: p('en'),
      lemmaIds: p('lemmaIds'),
      grammarIds: p('grammarIds'),
      tokens: p('tokens'),
      source: p('source'),
      licence: p('licence'),
    })
    .prepare();

  db.run(sql`BEGIN IMMEDIATE`);
  try {
    db.delete(sentence).run();
    db.delete(lemma).run();
    db.delete(grammarPoint).run();
    await writeAll('grammar_point', content.grammarPoints, (row) => {
      insertGrammar.run(row);
    });
    await writeAll('lemma', content.lemmas, (row) => {
      insertLemma.run({ ...row, audioRef: row.audioRef ?? null });
    });
    await writeAll('sentence', content.sentences, (row) => {
      insertSentence.run({ ...row, tokens: row.tokens ?? null });
    });
    const meta = createMetaRepo(db, () => '');
    meta.set(META_KEYS.seedVersion, JSON.stringify(content.version));
    meta.set(META_KEYS.seedGeneratedAt, content.generatedAt);
    db.run(sql`COMMIT`);
  } catch (error) {
    db.run(sql`ROLLBACK`);
    throw error;
  }

  return { status: 'imported', version: content.version, previousVersion, rowsWritten: total };
}
