/**
 * Test-only helper: an in-memory database with the real content seed from
 * `@italia/content` imported, the way the app imports it on first launch.
 * Takes a couple of seconds; use once per test file (in `beforeAll`).
 */
import { readFileSync } from 'node:fs';

import { importSeed } from '@/data/seed/importSeed';
import { createTestDatabase, type TestDatabase } from '@/db/testing/createTestDatabase';

/** The committed seed file's parsed JSON. */
export function readRealSeed(): unknown {
  return JSON.parse(readFileSync(require.resolve('@italia/content/seed.v1.json'), 'utf8'));
}

/** A fresh test database with the real seed imported; call `close()` after. */
export async function createRealSeedDatabase(): Promise<TestDatabase> {
  const t = createTestDatabase();
  await importSeed(t.db, readRealSeed(), { yieldBetweenBatches: () => Promise.resolve() });
  return t;
}
