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
import { SpeechProvider } from '@/speech';
import { createFakeSpeechServices } from '@/speech/testing';
import { FIXTURE_SEED } from '@/testing/fixtureSeed';
import { ThemeProvider } from '@/ui';

/** A seeded in-memory database and its repositories. */
export interface TestApp {
  t: TestDatabase;
  repos: Repositories;
  /** Fake speech services the wrapped tree uses. */
  speech: ReturnType<typeof createFakeSpeechServices>;
  /** Wraps a tree in the theme, database and (fake) speech providers. */
  wrap: (children: ReactNode) => ReactElement;
}

/** Create a fixture-seeded database; call `t.close()` after the test. */
export async function createTestApp(): Promise<TestApp> {
  const t = createTestDatabase();
  const repos = createRepositories(t.db, { newId: sequentialIds() });
  await importSeedContent(t.db, FIXTURE_SEED, { yieldBetweenBatches: () => Promise.resolve() });
  useSettingsStore.getState().hydrate(repos);
  const speech = createFakeSpeechServices();
  return {
    t,
    repos,
    speech,
    wrap: (children) => (
      <ThemeProvider scheme="light">
        <RepositoryProvider db={t.db} repos={repos}>
          <SpeechProvider services={speech}>{children}</SpeechProvider>
        </RepositoryProvider>
      </ThemeProvider>
    ),
  };
}
