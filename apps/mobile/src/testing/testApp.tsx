/**
 * Test-only helpers for rendering screens against a real in-memory database
 * seeded with the development fixture. Never import from app code.
 */
import type { ReactElement, ReactNode } from 'react';

import {
  createModelFileRepo,
  createRepositories,
  importSeedContent,
  type Repositories,
} from '@/data';
import { RepositoryProvider } from '@/db';
import {
  createTestDatabase,
  sequentialIds,
  type TestDatabase,
} from '@/db/testing/createTestDatabase';
import { useSettingsStore } from '@/features/settings/settingsStore';
import { capabilityFor, MANIFEST, ModelManager, ModelsProvider } from '@/models';
import { FakeStorage } from '@/models/testing';
import { SpeechProvider } from '@/speech';
import { createFakeSpeechServices } from '@/speech/testing';
import { FIXTURE_SEED } from '@/testing/fixtureSeed';
import { ThemeProvider } from '@/ui';

/** A seeded in-memory database and its repositories. */
export interface TestApp {
  t: TestDatabase;
  repos: Repositories;
  /** Fake speech services the wrapped tree uses (record what was said and played). */
  speech: ReturnType<typeof createFakeSpeechServices>;
  /** Model downloads the wrapped tree sees: an 8 GB phone with nothing installed. */
  models: ModelManager;
  /** Wraps a tree in the theme, database, models and (fake) speech providers. */
  wrap: (children: ReactNode) => ReactElement;
}

/** Create a fixture-seeded database; call `t.close()` after the test. */
export async function createTestApp(): Promise<TestApp> {
  const t = createTestDatabase();
  const repos = createRepositories(t.db, { newId: sequentialIds() });
  await importSeedContent(t.db, FIXTURE_SEED, { yieldBetweenBatches: () => Promise.resolve() });
  useSettingsStore.getState().hydrate(repos);
  const speech = createFakeSpeechServices();
  const models = new ModelManager({
    manifest: MANIFEST,
    repo: createModelFileRepo(t.db),
    storage: new FakeStorage(),
    network: { connection: () => Promise.resolve('wifi') },
    capability: capabilityFor(8 * 1024 ** 3),
  });
  return {
    t,
    repos,
    speech,
    models,
    wrap: (children) => (
      <ThemeProvider scheme="light">
        <RepositoryProvider db={t.db} repos={repos}>
          <ModelsProvider manager={models}>
            <SpeechProvider services={speech}>{children}</SpeechProvider>
          </ModelsProvider>
        </RepositoryProvider>
      </ThemeProvider>
    ),
  };
}
