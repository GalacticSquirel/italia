/**
 * Loads the content seed bundled with the app. Injectable so tests (and
 * future download-based delivery) can supply their own.
 */

import placeholderSeed from './placeholder-seed.json';

/** Returns the raw seed object to import (validated by `importSeed`). */
export type SeedLoader = () => Promise<unknown>;

/**
 * Default loader: the seed bundled in the app binary.
 *
 * TODO(content): point this at the seed JSON produced by `packages/content`
 * (for example `assets/seed/seed.json`, copied in by the content build). Until
 * then it loads an empty placeholder seed (version 0). For a large seed,
 * switch to reading the asset file with expo-asset and expo-file-system so it
 * is not parsed as part of the JS bundle.
 */
export const bundledSeedLoader: SeedLoader = () => Promise.resolve(placeholderSeed);
