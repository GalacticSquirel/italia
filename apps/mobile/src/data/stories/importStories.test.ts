import { readFileSync } from 'node:fs';

import { createRepositories, type Repositories } from '@/data/repositories';
import {
  createTestDatabase,
  sequentialIds,
  type TestDatabase,
} from '@/db/testing/createTestDatabase';
import { FIXTURE_STORIES } from '@/testing/fixtureStories';

import { ensureStories } from './ensureStories';
import { getImportedStories, importStories, storiesIdentity } from './importStories';
import type { StoriesLoader } from './storiesLoader';
import { storyBodyOf } from './storyBody';

let t: TestDatabase;
let repos: Repositories;
const NOW = new Date('2026-11-15T10:00:00.000Z');

beforeEach(() => {
  t = createTestDatabase();
  repos = createRepositories(t.db, { newId: sequentialIds() });
});

afterEach(() => {
  t.close();
});

describe('importStories', () => {
  it('imports every story with its body and series, and records the identity', () => {
    const result = importStories(t.db, FIXTURE_STORIES, NOW);
    expect(result.status).toBe('imported');
    expect(result.storiesWritten).toBe(4);
    expect(getImportedStories(t.db)).toEqual(storiesIdentity(FIXTURE_STORIES));

    const rows = repos.stories.listBundled();
    expect(rows.map((r) => r.id)).toEqual([
      'anna-in-citta-01',
      'anna-in-citta-02',
      'casa-di-marco-01',
      'casa-di-marco-02',
    ]);
    const first = repos.stories.getById('casa-di-marco-01');
    expect(first).toMatchObject({
      level: 'A1',
      seriesId: 'casa-di-marco',
      seriesIndex: 1,
      title: 'A casa',
      source: 'bundled',
      audioRef: null,
    });
    const body = first ? storyBodyOf(first) : null;
    expect(body?.titleEn).toBe('At home');
    expect(body?.series).toEqual({
      titleIt: 'La casa di Marco',
      titleEn: "Marco's house",
      blurb: 'Marco at home with his cat.',
    });
    expect(body?.paragraphs[0]?.sentences[0]?.it).toBe('Marco è a casa.');
    expect(body?.targetLemmaIds).toEqual([31, 32, 30]);
  });

  it('is idempotent and replaces bundled stories when the content changes', () => {
    importStories(t.db, FIXTURE_STORIES, NOW);
    expect(importStories(t.db, FIXTURE_STORIES, NOW).status).toBe('up-to-date');

    repos.stories.save({
      id: 'generated-1',
      level: 'A1',
      seriesId: null,
      seriesIndex: null,
      title: 'Mine',
      bodyJson: {},
      audioRef: null,
      wordTimings: null,
      source: 'generated',
    });
    const updated = {
      ...FIXTURE_STORIES,
      stories: FIXTURE_STORIES.stories
        .filter((s) => s.id !== 'anna-in-citta-02')
        .map((s) =>
          s.id === 'casa-di-marco-01' ? { ...s, title: { it: 'In casa', en: 'At home' } } : s,
        ),
    };
    const result = importStories(t.db, updated, NOW);
    expect(result.status).toBe('imported');
    expect(result.previous).toEqual(storiesIdentity(FIXTURE_STORIES));
    expect(repos.stories.listBundled()).toHaveLength(3);
    expect(repos.stories.getById('casa-di-marco-01')?.title).toBe('In casa');
    expect(repos.stories.getById('anna-in-citta-02')).toBeNull();
    expect(repos.stories.getById('generated-1')?.title).toBe('Mine');
  });

  it('keeps a newer format and rejects invalid files without changing anything', () => {
    importStories(t.db, FIXTURE_STORIES, NOW);
    repos.meta.set('stories.version', JSON.stringify({ version: 2, digest: 'x' }));
    expect(importStories(t.db, FIXTURE_STORIES, NOW).status).toBe('skipped-older');

    const before = repos.stories.listBundled().length;
    expect(() => importStories(t.db, { ...FIXTURE_STORIES, stories: [{ id: 'bad' }] })).toThrow();
    expect(repos.stories.listBundled()).toHaveLength(before);
  });

  it('imports the real bundled corpus', () => {
    const data: unknown = JSON.parse(
      readFileSync(require.resolve('@italia/content/stories.v1.json'), 'utf8'),
    );
    const result = importStories(t.db, data, NOW);
    expect(result.status).toBe('imported');
    expect(result.storiesWritten).toBeGreaterThanOrEqual(40);
    for (const row of repos.stories.listBundled()) {
      expect(storyBodyOf(row)).not.toBeNull();
    }
  });
});

describe('ensureStories', () => {
  it('reads the file only when its fingerprint changes', async () => {
    let loads = 0;
    const loader = (fingerprint: string): StoriesLoader => ({
      fingerprint: () => fingerprint,
      load: () => {
        loads += 1;
        return Promise.resolve(FIXTURE_STORIES);
      },
    });
    expect((await ensureStories(t.db, loader('a'))).status).toBe('imported');
    expect(await ensureStories(t.db, loader('a'))).toEqual({ status: 'up-to-date', loaded: false });
    expect(loads).toBe(1);
    const again = await ensureStories(t.db, loader('b'));
    expect(again).toMatchObject({ status: 'up-to-date', loaded: true });
    expect(loads).toBe(2);
  });
});
