import { eq } from 'drizzle-orm';

import { parseStoriesFile, toStoryRow, type StoriesFile } from '@italia/content';

import { story } from '@/db/schema';
import type { AppDatabase } from '@/db/types';

import { createMetaRepo, META_KEYS } from '../MetaRepo';
import type { NewStoryRow } from '../rows';
import { STORY_BODY_FORMAT, type StoredStoryBody } from './storyBody';

/** Identity of an imported stories file. */
export interface StoriesIdentity {
  /** The file's format version (`StoriesFile.version`). */
  version: number;
  /** Hash of the file's content, so a content update with the same version is imported. */
  digest: string;
}

/** Outcome of {@link importStories}. */
export interface ImportStoriesResult {
  /**
   * `imported`: bundled stories replaced with this file's; `up-to-date`: this
   * content is already imported; `skipped-older`: a newer format is imported.
   */
  status: 'imported' | 'up-to-date' | 'skipped-older';
  identity: StoriesIdentity;
  previous: StoriesIdentity | null;
  /** Stories written (0 unless imported). */
  storiesWritten: number;
}

/** 32-bit FNV-1a of a string, as 8 hex digits. */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** The identity of a validated stories file. */
export function storiesIdentity(file: StoriesFile): StoriesIdentity {
  return {
    version: file.version,
    digest: `${file.seedSha256.slice(0, 16)}-${fnv1a(JSON.stringify([file.series, file.stories]))}`,
  };
}

/** The identity of the stories currently imported, or null if none. */
export function getImportedStories(db: AppDatabase): StoriesIdentity | null {
  const raw = createMetaRepo(db, () => '').get(META_KEYS.storiesVersion);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoriesIdentity> | null;
    return typeof parsed?.version === 'number' && typeof parsed.digest === 'string'
      ? { version: parsed.version, digest: parsed.digest }
      : null;
  } catch {
    return null;
  }
}

/** The `story` rows for a validated stories file. */
export function storyRowsFromFile(file: StoriesFile, now: Date): NewStoryRow[] {
  const seriesById = new Map(file.series.map((s) => [s.id, s]));
  return file.stories.map((s) => {
    const row = toStoryRow(s);
    const series = seriesById.get(s.seriesId);
    if (!series) throw new Error(`Story ${s.id} names an unknown series ${s.seriesId}`);
    const body: StoredStoryBody = {
      ...row.bodyJson,
      format: STORY_BODY_FORMAT,
      series: { titleIt: series.title.it, titleEn: series.title.en, blurb: series.blurb },
    };
    return { ...row, bodyJson: body, createdAt: now };
  });
}

/**
 * Import the bundled graded stories (`@italia/content/stories.v1.json`) into
 * the `story` table, after the content seed whose lemma ids they use.
 *
 * Validated against the canonical schema, idempotent and versioned like the
 * seed import: the imported identity (format version and content digest) is
 * stored in device-local metadata, re-running with the same file is a no-op,
 * a file of an older format is ignored, and any other change replaces every
 * bundled story in one transaction (stories generated on the device are
 * kept). Reading progress refers to stories by id, so it survives.
 *
 * @param data - parsed stories JSON
 * @throws ZodError when the file does not match the schema
 */
export function importStories(
  db: AppDatabase,
  data: unknown,
  now: Date = new Date(),
): ImportStoriesResult {
  const file = parseStoriesFile(data);
  const identity = storiesIdentity(file);
  const previous = getImportedStories(db);
  if (previous !== null) {
    if (previous.version > identity.version) {
      return { status: 'skipped-older', identity, previous, storiesWritten: 0 };
    }
    if (previous.version === identity.version && previous.digest === identity.digest) {
      return { status: 'up-to-date', identity, previous, storiesWritten: 0 };
    }
  }
  const rows = storyRowsFromFile(file, now);
  const ids = new Set<string>();
  for (const r of rows) {
    if (ids.has(r.id)) throw new Error(`Stories file repeats story id ${r.id}`);
    ids.add(r.id);
  }

  db.transaction((tx) => {
    tx.delete(story).where(eq(story.source, 'bundled')).run();
    for (const row of rows) tx.insert(story).values(row).run();
    createMetaRepo(tx, () => '').set(META_KEYS.storiesVersion, JSON.stringify(identity), now);
  });
  return { status: 'imported', identity, previous, storiesWritten: rows.length };
}
