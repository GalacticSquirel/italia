import { bundledSeedLoader, type SeedLoader } from '@/data';

function isEmptySeed(seed: unknown): boolean {
  return (
    typeof seed === 'object' &&
    seed !== null &&
    Array.isArray((seed as { lemmas?: unknown }).lemmas) &&
    (seed as { lemmas: unknown[] }).lemmas.length === 0
  );
}

/**
 * The app's seed loader. In development builds, while the bundled seed is
 * still the empty placeholder, it loads the DEVELOPMENT FIXTURE seed instead
 * so screens can be exercised. Production builds always use the bundled
 * seed; the `__DEV__` branch (and the fixture) is removed from them.
 */
export const appSeedLoader: SeedLoader = async () => {
  const bundled = await bundledSeedLoader();
  if (__DEV__ && isEmptySeed(bundled)) {
    const { DEV_FIXTURE_SEED } = await import('./fixtureSeed');
    return DEV_FIXTURE_SEED;
  }
  return bundled;
};
