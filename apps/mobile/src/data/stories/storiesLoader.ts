/**
 * Loads the graded stories bundled with the app. Injectable so tests can
 * supply their own.
 */
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';

import storiesAsset from '@/assets/seed/stories.v1.seed';

import type { SeedLoader } from '../seed/seedLoader';

/** Where the bundled stories come from (same contract as the seed's loader). */
export type StoriesLoader = SeedLoader;

/**
 * Default loader: `@italia/content`'s `stories.v1.json`, bundled as an asset
 * (copied to `assets/seed/stories.v1.seed` by `scripts/sync-seed-asset.js`)
 * and read only when its content hash differs from the last import's.
 */
export const bundledStoriesLoader: StoriesLoader = {
  fingerprint: () => Asset.fromModule(storiesAsset).hash,
  load: async () => {
    const asset = await Asset.fromModule(storiesAsset).downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    return JSON.parse(await new File(uri).text()) as unknown;
  },
};
