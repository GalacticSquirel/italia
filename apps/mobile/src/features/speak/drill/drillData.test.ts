import { createScheduler } from '@italia/core';

import { createRepositories, importSeedContent, type Repositories } from '@/data';
import {
  createTestDatabase,
  sequentialIds,
  type TestDatabase,
} from '@/db/testing/createTestDatabase';
import { getContentIndex } from '@/features/study/content';
import { FIXTURE_SEED } from '@/testing/fixtureSeed';

import { loadSpeakingDrill } from './drillData';

let t: TestDatabase;
let repos: Repositories;
const at = new Date(2026, 10, 16, 9, 0, 0);

beforeEach(async () => {
  t = createTestDatabase();
  repos = createRepositories(t.db, { newId: sequentialIds() });
  await importSeedContent(t.db, FIXTURE_SEED, { yieldBetweenBatches: () => Promise.resolve() });
});

afterEach(() => {
  t.close();
});

describe('speaking drill data', () => {
  it('is empty before any sentence is known', () => {
    expect(loadSpeakingDrill(repos, at).items).toEqual([]);
  });

  it('serves due spoken reviews and records graded answers', () => {
    const scheduler = createScheduler();
    const past = new Date(at.getTime() - 30 * 86_400_000);
    const sentence = getContentIndex(repos).sentencesByLength[0];
    if (!sentence) throw new Error('fixture has no sentences');
    repos.cards.createMany([
      {
        kind: 'spoken_prompt',
        targetId: sentence.id,
        promptMode: 'spoken',
        schedule: scheduler.review(scheduler.newCard(past), 'good', past).card,
      },
    ]);
    const drill = loadSpeakingDrill(repos, at);
    expect(drill.items).toEqual([
      {
        cardId: `spoken_prompt:${String(sentence.id)}:spoken`,
        cue: sentence.en,
        answer: sentence.it,
        accepted: [sentence.it],
      },
    ]);
    const cardId = drill.items[0]?.cardId ?? '';
    drill.record(
      { cardId, rating: 'good', transcript: sentence.it, latencyMs: 3500, correctInTheEnd: true },
      at,
    );
    const log = repos.reviewLogs.listRecent(1)[0];
    expect(log).toMatchObject({ cardId, rating: 'good', answer: sentence.it, latencyMs: 3500 });
    expect(repos.cards.getById(cardId)?.due.getTime()).toBeGreaterThan(at.getTime());
  });
});
