import type { AppDatabase } from '@/db/types';

import { createMetaRepo, META_KEYS } from '../MetaRepo';
import {
  getImportedSeed,
  importSeed,
  type ImportSeedOptions,
  type ImportSeedResult,
} from './importSeed';
import type { SeedLoader } from './seedLoader';

/** Outcome of {@link ensureSeed}. */
export type EnsureSeedResult =
  (ImportSeedResult & { loaded: true }) | { status: 'up-to-date'; loaded: false };

/**
 * Make sure the seed from `loader` is imported, at app start.
 *
 * When the loader's fingerprint matches the one recorded after the last
 * import, the seed is not even read (so a normal launch costs one metadata
 * query). Otherwise it is loaded and passed to {@link importSeed}, which
 * imports it only if it is newer than the content on the device, and the
 * fingerprint is recorded.
 */
export async function ensureSeed(
  db: AppDatabase,
  loader: SeedLoader,
  options: ImportSeedOptions = {},
): Promise<EnsureSeedResult> {
  const meta = createMetaRepo(db, () => '');
  const fingerprint = loader.fingerprint();
  if (
    fingerprint !== null &&
    getImportedSeed(db) !== null &&
    meta.get(META_KEYS.seedFingerprint) === fingerprint
  ) {
    return { status: 'up-to-date', loaded: false };
  }
  const result = await importSeed(db, await loader.load(), options);
  if (fingerprint !== null) meta.set(META_KEYS.seedFingerprint, fingerprint);
  return { ...result, loaded: true };
}
