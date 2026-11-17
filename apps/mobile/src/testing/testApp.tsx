/**
 * Test-only helpers for rendering screens against a real in-memory database
 * seeded with the development fixture. Never import from app code.
 */
import type { ReactElement, ReactNode } from 'react';

import { createRepositories, importSeedContent, type Repositories } from '@/data';
import { RepositoryProvider } from '@/db';
import {
  createTestDatabase,
  sequentialIds,
  type TestDatabase,
} from '@/db/testing/createTestDatabase';
import { useSettingsStore } from '@/features/settings/settingsStore';
import { FIXTURE_SEED } from '@/testing/fixtureSeed';
import { ThemeProvider } from '@/ui';

/** A seeded in-memory database and its repositories. */
export interface TestApp {
  t: TestDatabase;
  repos: Repositories;
  /** Wraps a tree in the theme and the database providers. */
  wrap: (children: ReactNode) => ReactElement;
}

/** Create a fixture-seeded database; call `t.close()` after the test. */
export async function createTestApp(): Promise<TestApp> {
  const t = createTestDatabase();
  const repos = createRepositories(t.db, { newId: sequentialIds() });
  await importSeedContent(t.db, FIXTURE_SEED, { yieldBetweenBatches: () => Promise.resolve() });
  useSettingsStore.getState().hydrate(repos);
  return {
    t,
    repos,
    wrap: (children) => (
      <ThemeProvider scheme="light">
        <RepositoryProvider db={t.db} repos={repos}>
          {children}
        </RepositoryProvider>
      </ThemeProvider>
    ),
  };
}
