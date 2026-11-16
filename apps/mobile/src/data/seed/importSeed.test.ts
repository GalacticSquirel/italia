import {
  createTestDatabase,
  sequentialIds,
  type TestDatabase,
} from '@/db/testing/createTestDatabase';

import { createRepositories, type Repositories } from '../repositories';
import { getImportedSeedVersion, importSeed, type SeedImportProgress } from './importSeed';
import { bundledSeedLoader } from './seedLoader';
import { compareSeedVersions, type Seed } from './seedSchema';
import { at, makeSeed, schedule } from '../testing/fixtures';

let t: TestDatabase;
let repos: Repositories;
const noYield = (): Promise<void> => Promise.resolve();

beforeEach(() => {
  t = createTestDatabase();
  repos = createRepositories(t.db, { newId: sequentialIds() });
});

afterEach(() => {
  t.close();
});

describe('importSeed', () => {
  it('imports content and records the version', async () => {
    const result = await importSeed(t.db, makeSeed(1), { yieldBetweenBatches: noYield });
    expect(result).toEqual({
      status: 'imported',
      version: 1,
      previousVersion: null,
      rowsWritten: 3 + 3 + 2,
    });
    expect(getImportedSeedVersion(t.db)).toBe(1);
    expect(repos.lemmas.count()).toBe(3);
    expect(repos.lemmas.listByFrequency({ limit: 2 }).map((l) => l.lemma)).toEqual([
      'parola1',
      'parola2',
    ]);
    expect(repos.sentences.listForLemma(2, 5).map((s) => s.id)).toEqual([2]);
    expect(repos.sentences.listForGrammarPoint(1, 10)).toHaveLength(3);
    expect(repos.grammar.listInOrder().map((g) => g.title)).toEqual([
      'Presente',
      'Passato prossimo',
    ]);
  });

  it('is a no-op when re-run with the same version', async () => {
    await importSeed(t.db, makeSeed(1), { yieldBetweenBatches: noYield });
    const onProgress = jest.fn();
    const changed = makeSeed(1, 5);
    const result = await importSeed(t.db, changed, { onProgress, yieldBetweenBatches: noYield });
    expect(result.status).toBe('up-to-date');
    expect(result.rowsWritten).toBe(0);
    expect(onProgress).not.toHaveBeenCalled();
    expect(repos.lemmas.count()).toBe(3);
  });

  it('ignores an older version', async () => {
    await importSeed(t.db, makeSeed('2.0'), { yieldBetweenBatches: noYield });
    const result = await importSeed(t.db, makeSeed('1.9', 10), { yieldBetweenBatches: noYield });
    expect(result.status).toBe('skipped-older');
    expect(repos.lemmas.count()).toBe(3);
  });

  it('applies a newer version without touching learner data', async () => {
    await importSeed(t.db, makeSeed(1), { yieldBetweenBatches: noYield });
    const card = repos.cards.create({
      kind: 'cloze_production',
      targetId: 1,
      promptMode: 'typed',
      schedule: schedule({ state: 'review', reps: 1 }),
    });
    repos.reviewLogs.append({
      cardId: card.id,
      rating: 'good',
      answer: null,
      latencyMs: 900,
      reviewedAt: at(1),
      deviceId: 'd',
    });
    repos.settings.set('dailyNewLimit', 5);

    // v2 swaps the first two frequency ranks (exercising the unique index), edits a gloss,
    // drops lemma 3 and adds lemmas 4 and 5.
    const v2: Seed = makeSeed(2, 5);
    v2.lemmas = v2.lemmas
      .filter((l) => l.id !== 3)
      .map((l) => {
        if (l.id === 1) return { ...l, freqRank: 2, glossEn: 'updated' };
        if (l.id === 2) return { ...l, freqRank: 1 };
        return l;
      });
    v2.sentences = v2.sentences.filter((s) => s.id !== 3);

    const result = await importSeed(t.db, v2, { yieldBetweenBatches: noYield });
    expect(result).toMatchObject({ status: 'imported', previousVersion: 1, version: 2 });
    expect(repos.lemmas.listByFrequency({ limit: 10 }).map((l) => l.id)).toEqual([2, 1, 4, 5]);
    expect(repos.lemmas.getById(1)?.glossEn).toBe('updated');
    expect(repos.lemmas.getById(3)).toBeNull();
    expect(repos.cards.getById(card.id)).toEqual(card);
    expect(repos.reviewLogs.count()).toBe(1);
    expect(repos.settings.get('dailyNewLimit')).toBe(5);
  });

  it('writes thousands of rows in batches and reports progress', async () => {
    const seed = makeSeed(1, 5000);
    const progress: SeedImportProgress[] = [];
    let yields = 0;
    const started = performance.now();
    await importSeed(t.db, seed, {
      batchSize: 500,
      onProgress: (p) => progress.push(p),
      yieldBetweenBatches: () => {
        yields += 1;
        return Promise.resolve();
      },
    });
    const elapsedMs = performance.now() - started;

    const total = 5000 + 5000 + 2;
    expect(progress.at(-1)).toEqual({ done: total, total, table: 'sentence' });
    expect(progress.map((p) => p.done)).toEqual(
      [...progress.map((p) => p.done)].sort((a, b) => a - b),
    );
    expect(progress).toHaveLength(1 + 10 + 10);
    expect(yields).toBe(progress.length);
    expect(repos.sentences.count()).toBe(5000);
    // Generous bound to catch accidental row-by-row inserts, not to benchmark.
    expect(elapsedMs).toBeLessThan(5000);
  });

  it('rolls back everything when a batch fails', async () => {
    await importSeed(t.db, makeSeed(1), { yieldBetweenBatches: noYield });
    const bad = makeSeed(2, 4);
    const last = bad.lemmas[3];
    if (!last) throw new Error('fixture');
    bad.lemmas[3] = { ...last, freqRank: 1 }; // violates the unique freq_rank index
    await expect(
      importSeed(t.db, bad, { batchSize: 2, yieldBetweenBatches: noYield }),
    ).rejects.toThrow();
    expect(getImportedSeedVersion(t.db)).toBe(1);
    expect(repos.lemmas.count()).toBe(3);
  });

  it('rejects malformed seeds and duplicate ids before writing', async () => {
    await expect(importSeed(t.db, { version: 1 })).rejects.toThrow();
    const dup = makeSeed(1);
    const first = dup.lemmas[0];
    if (!first) throw new Error('fixture');
    dup.lemmas.push({ ...first, lemma: 'altra', freqRank: 99 });
    await expect(importSeed(t.db, dup)).rejects.toThrow(/duplicate lemma id 1/);
    expect(getImportedSeedVersion(t.db)).toBeNull();
  });

  it('accepts the bundled placeholder seed', async () => {
    const result = await importSeed(t.db, await bundledSeedLoader());
    expect(result.status).toBe('imported');
    expect(getImportedSeedVersion(t.db)).toBe(0);
  });
});

describe('compareSeedVersions', () => {
  it('orders numbers and dotted strings numerically', () => {
    expect(compareSeedVersions(2, 10)).toBeLessThan(0);
    expect(compareSeedVersions('1.10', '1.2')).toBeGreaterThan(0);
    expect(compareSeedVersions('3', 3)).toBe(0);
    expect(compareSeedVersions('1.0', 1)).toBe(0);
    expect(compareSeedVersions('2026.11.15', '2026.11.2')).toBeGreaterThan(0);
  });
});
