import type { AppDatabase } from '@/db/types';

import { createMetaRepo, META_KEYS } from '../MetaRepo';
import { getImportedStories, importStories, type ImportStoriesResult } from './importStories';
import type { StoriesLoader } from './storiesLoader';

/** Outcome of {@link ensureStories}. */
export type EnsureStoriesResult =
  (ImportStoriesResult & { loaded: true }) | { status: 'up-to-date'; loaded: false };

/**
 * Make sure the bundled stories are imported, at app start (after the seed).
 * When the loader's fingerprint matches the one recorded at the last import,
 * the file is not read at all.
 */
export async function ensureStories(
  db: AppDatabase,
  loader: StoriesLoader,
): Promise<EnsureStoriesResult> {
  const meta = createMetaRepo(db, () => '');
  const fingerprint = loader.fingerprint();
  if (
    fingerprint !== null &&
    getImportedStories(db) !== null &&
    meta.get(META_KEYS.storiesFingerprint) === fingerprint
  ) {
    return { status: 'up-to-date', loaded: false };
  }
  const result = importStories(db, await loader.load());
  if (fingerprint !== null) meta.set(META_KEYS.storiesFingerprint, fingerprint);
  return { ...result, loaded: true };
}
