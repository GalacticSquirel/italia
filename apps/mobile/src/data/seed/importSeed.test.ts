import {
  createTestDatabase,
  sequentialIds,
  type TestDatabase,
} from '@/db/testing/createTestDatabase';

import { createRepositories, type Repositories } from '../repositories';
import { ensureSeed } from './ensureSeed';
import {
  getImportedSeed,
  getImportedSeedVersion,
  importSeed,
  importSeedContent,
  type SeedImportProgress,
} from './importSeed';
import { compareSeeds, compareSeedVersions, seedToContent, type SeedContent } from './seedContent';
import type { SeedLoader } from './seedLoader';
import { at, makeCanonicalSeed, makeSeed, schedule } from '../testing/fixtures';

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

describe('importSeedContent', () => {
  it('imports content and records the version', async () => {
    const result = await importSeedContent(t.db, makeSeed(1), { yieldBetweenBatches: noYield });
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
    await importSeedContent(t.db, makeSeed(1), { yieldBetweenBatches: noYield });
    const onProgress = jest.fn();
    const changed = makeSeed(1, 5);
    const result = await importSeedContent(t.db, changed, {
      onProgress,
      yieldBetweenBatches: noYield,
    });
    expect(result.status).toBe('up-to-date');
    expect(result.rowsWritten).toBe(0);
    expect(onProgress).not.toHaveBeenCalled();
    expect(repos.lemmas.count()).toBe(3);
  });

  it('ignores an older version', async () => {
    await importSeedContent(t.db, makeSeed('2.0'), { yieldBetweenBatches: noYield });
    const result = await importSeedContent(t.db, makeSeed('1.9', 10), {
      yieldBetweenBatches: noYield,
    });
    expect(result.status).toBe('skipped-older');
    expect(repos.lemmas.count()).toBe(3);
  });

  it('applies a newer version without touching learner data', async () => {
    await importSeedContent(t.db, makeSeed(1), { yieldBetweenBatches: noYield });
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
    const v2: SeedContent = makeSeed(2, 5);
    v2.lemmas = v2.lemmas
      .filter((l) => l.id !== 3)
      .map((l) => {
        if (l.id === 1) return { ...l, freqRank: 2, glossEn: 'updated' };
        if (l.id === 2) return { ...l, freqRank: 1 };
        return l;
      });
    v2.sentences = v2.sentences.filter((s) => s.id !== 3);

    const result = await importSeedContent(t.db, v2, { yieldBetweenBatches: noYield });
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
    await importSeedContent(t.db, seed, {
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
    await importSeedContent(t.db, makeSeed(1), { yieldBetweenBatches: noYield });
    const bad = makeSeed(2, 4);
    const last = bad.lemmas[3];
    if (!last) throw new Error('fixture');
    bad.lemmas[3] = { ...last, freqRank: 1 }; // violates the unique freq_rank index
    await expect(
      importSeedContent(t.db, bad, { batchSize: 2, yieldBetweenBatches: noYield }),
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
    await expect(importSeedContent(t.db, dup)).rejects.toThrow(/duplicate lemma id 1/);
    expect(getImportedSeedVersion(t.db)).toBeNull();
  });

  it('imports a newer generation of the same version and skips an older one', async () => {
    await importSeedContent(t.db, makeSeed(1, 3, '2026-11-15T00:00:00.000Z'), {
      yieldBetweenBatches: noYield,
    });
    const newer = await importSeedContent(t.db, makeSeed(1, 4, '2026-12-01T00:00:00Z'), {
      yieldBetweenBatches: noYield,
    });
    expect(newer).toMatchObject({ status: 'imported', previousVersion: 1, rowsWritten: 4 + 4 + 2 });
    expect(getImportedSeed(t.db)).toEqual({ version: 1, generatedAt: '2026-12-01T00:00:00Z' });
    const older = await importSeedContent(t.db, makeSeed(1, 9, '2026-11-20T00:00:00.000Z'), {
      yieldBetweenBatches: noYield,
    });
    expect(older.status).toBe('skipped-older');
    // Same instant written differently is the same seed.
    const same = await importSeedContent(t.db, makeSeed(1, 9, '2026-12-01T00:00:00.000Z'), {
      yieldBetweenBatches: noYield,
    });
    expect(same.status).toBe('up-to-date');
    expect(repos.lemmas.count()).toBe(4);
  });
});

describe('importSeed (canonical @italia/content seed)', () => {
  it('validates with the canonical schema and maps extra.tokens to lemma ids', async () => {
    const result = await importSeed(t.db, makeCanonicalSeed(), { yieldBetweenBatches: noYield });
    expect(result).toMatchObject({ status: 'imported', version: 1, rowsWritten: 6 + 2 + 2 });
    expect(repos.sentences.getById(101)?.tokens).toEqual([
      [0, 2, 1],
      [3, 8, 4],
      [9, 10, 2],
      // "nel" = in + il
      [11, 14, 3, 1],
      [15, 23, 5],
    ]);
    // The name "Mario" keeps its span but has no lemma.
    expect(repos.sentences.getById(102)?.tokens).toEqual([
      [0, 5],
      [6, 12, 6],
    ]);
    expect(repos.lemmas.getById(4)).toEqual({
      id: 4,
      lemma: 'gatto',
      pos: 'NOUN',
      freqRank: 4,
      glossEn: 'cat',
      audioRef: null,
    });
    expect(repos.grammar.listInOrder().map((g) => g.id)).toEqual([1, 2]);
  });

  it('rejects a seed that breaks the canonical schema without writing', async () => {
    const bad = makeCanonicalSeed();
    const first = bad.sentences[0];
    if (!first) throw new Error('fixture');
    first.extra.tokens.push([20, 99, 0]); // past the end of the sentence
    await expect(importSeed(t.db, bad)).rejects.toThrow(/outside sentence 101/);
    await expect(importSeed(t.db, { ...makeCanonicalSeed(), version: 2 })).rejects.toThrow();
    expect(getImportedSeedVersion(t.db)).toBeNull();
    expect(repos.lemmas.count()).toBe(0);
  });

  it('seedToContent drops extra and keeps every row', () => {
    const seed = makeCanonicalSeed();
    const content = seedToContent(seed);
    expect(content.lemmas).toHaveLength(seed.lemmas.length);
    expect(content.sentences).toHaveLength(seed.sentences.length);
    for (const row of [...content.lemmas, ...content.sentences, ...content.grammarPoints]) {
      expect(row).not.toHaveProperty('extra');
    }
  });
});

describe('ensureSeed', () => {
  const loaderFor = (seed: unknown, fingerprint: string | null) => {
    const load = jest.fn(() => Promise.resolve(seed));
    const loader: SeedLoader = { fingerprint: () => fingerprint, load };
    return { loader, load };
  };

  it('imports on first launch, then skips loading while the fingerprint matches', async () => {
    const first = loaderFor(makeCanonicalSeed(), 'hash-a');
    const result = await ensureSeed(t.db, first.loader, { yieldBetweenBatches: noYield });
    expect(result).toMatchObject({ status: 'imported', loaded: true });
    expect(first.load).toHaveBeenCalledTimes(1);

    const again = loaderFor(makeCanonicalSeed(), 'hash-a');
    expect(await ensureSeed(t.db, again.loader)).toEqual({ status: 'up-to-date', loaded: false });
    expect(again.load).not.toHaveBeenCalled();
  });

  it('loads again when the fingerprint changes and imports only newer content', async () => {
    await ensureSeed(t.db, loaderFor(makeCanonicalSeed(), 'hash-a').loader, {
      yieldBetweenBatches: noYield,
    });
    const sameContent = loaderFor(makeCanonicalSeed(), 'hash-b');
    expect(await ensureSeed(t.db, sameContent.loader)).toMatchObject({
      status: 'up-to-date',
      loaded: true,
    });
    const updated = loaderFor(makeCanonicalSeed('2026-12-01T00:00:00.000Z'), 'hash-c');
    expect(await ensureSeed(t.db, updated.loader, { yieldBetweenBatches: noYield })).toMatchObject({
      status: 'imported',
      loaded: true,
    });
    expect(getImportedSeed(t.db)?.generatedAt).toBe('2026-12-01T00:00:00.000Z');
  });

  it('always loads without a fingerprint and records nothing on failure', async () => {
    const broken = loaderFor({ version: 1 }, 'hash-x');
    await expect(ensureSeed(t.db, broken.loader)).rejects.toThrow();
    const retry = loaderFor(makeCanonicalSeed(), null);
    await ensureSeed(t.db, retry.loader, { yieldBetweenBatches: noYield });
    await ensureSeed(t.db, retry.loader, { yieldBetweenBatches: noYield });
    expect(retry.load).toHaveBeenCalledTimes(2);
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

  it('compareSeeds orders by version, then by generation time', () => {
    const a = { version: 1, generatedAt: '2026-11-15T00:00:00Z' };
    expect(compareSeeds(a, { version: 2, generatedAt: '2020-01-01T00:00:00Z' })).toBeLessThan(0);
    expect(compareSeeds(a, { version: 1, generatedAt: '2026-11-14T00:00:00Z' })).toBeGreaterThan(0);
    expect(compareSeeds(a, { version: 1, generatedAt: null })).toBeGreaterThan(0);
    expect(compareSeeds(a, { ...a, generatedAt: '2026-11-15T00:00:00.000Z' })).toBe(0);
  });
});
