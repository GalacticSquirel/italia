/**
 * Imports the real seed from `@italia/content` (10,000 lemmas, about 36,000
 * sentences) into an in-memory database. Slower than the other tests (a few
 * seconds), but it is what the app does on first launch. Timings are logged, not
 * asserted: the same import takes 3 to 7 seconds on shared CI runners, so a time budget
 * here only adds flaky failures. Measure first-launch speed on a phone instead.
 */
import { readFileSync } from 'node:fs';

import { GRAMMAR_POINTS, parseSeed } from '@italia/content';

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
    expect(repos.lemmas.count()).toBe(10_000);
    expect(repos.sentences.count()).toBeGreaterThan(36_000);
    expect(repos.grammar.listInOrder()).toHaveLength(GRAMMAR_POINTS.length);
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
});
