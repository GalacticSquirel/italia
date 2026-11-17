/**
 * Imports the real seed from `@italia/content` (3,000 lemmas, about 14,000
 * sentences) into an in-memory database. Slower than the other tests (a few
 * seconds), but it is what the app does on first launch.
 */
import { readFileSync } from 'node:fs';

import { parseSeed } from '@italia/content';

import { createTestDatabase, type TestDatabase } from '@/db/testing/createTestDatabase';

import { createRepositories } from '../repositories';
import { getImportedSeed, importSeedContent, type SeedImportProgress } from './importSeed';
import { seedToContent } from './seedContent';

jest.setTimeout(30_000);

let t: TestDatabase;
const timings: Record<string, number> = {};

function timed<T>(name: string, run: () => T): T {
  const start = performance.now();
  const result = run();
  timings[name] = Math.round(performance.now() - start);
  return result;
}

beforeAll(async () => {
  t = createTestDatabase();
  const text = readFileSync(require.resolve('@italia/content/seed.v1.json'), 'utf8');
  const json = timed('JSON.parse', () => JSON.parse(text) as unknown);
  const seed = timed('validate', () => parseSeed(json));
  const content = timed('map', () => seedToContent(seed));
  const progress: SeedImportProgress[] = [];
  const start = performance.now();
  await importSeedContent(t.db, content, {
    onProgress: (p) => progress.push(p),
    yieldBetweenBatches: () => Promise.resolve(),
  });
  timings.write = Math.round(performance.now() - start);
  timings.progressEvents = progress.length;
  console.info(`Full seed import (ms): ${JSON.stringify(timings)}`);
});

afterAll(() => {
  t.close();
});

describe('full seed import', () => {
  it('writes every row and records the version', () => {
    const repos = createRepositories(t.db);
    expect(repos.lemmas.count()).toBe(3000);
    expect(repos.sentences.count()).toBeGreaterThan(14_000);
    expect(repos.grammar.listInOrder()).toHaveLength(38);
    expect(getImportedSeed(t.db)?.version).toBe(1);
  });

  it('stores tokens that point at lemmas of the sentence and spans inside it', () => {
    const sentences = createRepositories(t.db).sentences.listAll();
    for (const s of sentences) {
      expect(s.tokens?.length).toBeGreaterThan(0);
      const known = new Set(s.lemmaIds);
      for (const [start, end, ...ids] of s.tokens ?? []) {
        expect(end).toBeLessThanOrEqual(s.it.length);
        expect(start).toBeLessThan(end);
        for (const id of ids) expect(known.has(id)).toBe(true);
      }
    }
  });

  it('is fast enough for a first launch', () => {
    // Desktop budget; phones are a few times slower. Generous to avoid flakes on CI.
    expect((timings.validate ?? 0) + (timings.map ?? 0) + (timings.write ?? 0)).toBeLessThan(8000);
  });
});
