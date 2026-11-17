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
 * (`@italia/content/seed.v1.json`). Pass the parsed JSON as is: do not run it
 * through `toRows()` from `@italia/content`, which drops `extra`, where the
 * sentence tokens that cloze cards need live; `importSeed` reads them. Until
 * then it loads an empty placeholder seed (version 0). For a large seed,
 * switch to reading the asset file with expo-asset and expo-file-system so it
 * is not parsed as part of the JS bundle.
 */
export const bundledSeedLoader: SeedLoader = () => Promise.resolve(placeholderSeed);
