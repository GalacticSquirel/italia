/**
 * Loads the content seed bundled with the app. Injectable so tests (and
 * future download-based delivery) can supply their own.
 */
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';

import seedAsset from '@/assets/seed/seed.v1.seed';

/** Where a content seed comes from. */
export interface SeedLoader {
  /**
   * A cheap identity of the seed (such as the asset's content hash), read
   * without loading it, or null when there is none. When it matches the
   * fingerprint recorded at the last import, loading is skipped.
   */
  fingerprint: () => string | null;
  /** Read and parse the seed. The result is validated by `importSeed`. */
  load: () => Promise<unknown>;
}

/**
 * Default loader: `@italia/content`'s `seed.v1.json`, bundled as an asset
 * (copied to `assets/seed/seed.v1.seed` by `scripts/sync-seed-asset.js`) so
 * the JSON is not part of the JS bundle. It is read from disk and parsed only
 * when its content hash differs from the last import's.
 */
export const bundledSeedLoader: SeedLoader = {
  fingerprint: () => Asset.fromModule(seedAsset).hash,
  load: async () => {
    const asset = await Asset.fromModule(seedAsset).downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    return JSON.parse(await new File(uri).text()) as unknown;
  },
};
