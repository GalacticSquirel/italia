import { createScheduler, rebuildCardState } from '@italia/core';

import {
  createTestDatabase,
  sequentialIds,
  type TestDatabase,
} from '@/db/testing/createTestDatabase';

import { CardNotFoundError, toSchedule } from './CardRepo';
import { createRepositories, type Repositories } from './repositories';
import { at, schedule } from './testing/fixtures';

let t: TestDatabase;
let repos: Repositories;
let cardId: string;
const scheduler = createScheduler();

beforeEach(() => {
  t = createTestDatabase();
  repos = createRepositories(t.db, { newId: sequentialIds('log') });
  cardId = repos.cards.create({
    kind: 'cloze_production',
    targetId: 1,
    promptMode: 'typed',
    schedule: schedule(),
  }).id;
});

afterEach(() => {
  t.close();
});

const input = (minutes: number, rating: 'again' | 'good' = 'good') => ({
  cardId,
  rating,
  answer: null,
  latencyMs: 1000,
  reviewedAt: at(minutes),
  deviceId: 'device-a',
  scheduler,
});

describe('reviewCard', () => {
  it('appends the log and applies the review to the stored card', () => {
    const { log, card } = repos.reviewCard(input(1));
    expect(log.cardId).toBe(cardId);
    expect(toSchedule(card)).toEqual(scheduler.review(schedule(), 'good', at(1)).card);
    expect(repos.cards.getById(cardId)).toEqual(card);
  });

  it('builds on the stored state, not on a copy read before another review', () => {
    repos.reviewCard(input(1));
    repos.reviewCard(input(11));
    const card = repos.cards.getById(cardId);
    expect(card?.reps).toBe(2);
    expect(card && toSchedule(card)).toEqual(
      rebuildCardState(repos.reviewLogs.listForCard(cardId)),
    );
  });

  it('replays the logs when the review is older than the last one', () => {
    repos.reviewCard(input(24 * 60));
    const { card } = repos.reviewCard(input(60, 'again'));
    const logs = repos.reviewLogs.listForCard(cardId);
    expect(logs.map((l) => l.rating)).toEqual(['again', 'good']);
    expect(toSchedule(card)).toEqual(rebuildCardState(logs));
  });

  it('keeps nothing when the card does not exist', () => {
    expect(() => repos.reviewCard({ ...input(1), cardId: 'missing' })).toThrow(CardNotFoundError);
    expect(repos.reviewLogs.count()).toBe(0);
  });
});

describe('alignCardStates', () => {
  it('rebuilds every reviewed card once per retention change', () => {
    repos.reviewCard(input(1));
    repos.reviewCard(input(20));
    repos.reviewCard(input(3 * 24 * 60));
    // First run after upgrading records the retention (and rebuilds to be safe).
    expect(repos.alignCardStates(scheduler)).toBe(1);
    expect(repos.alignCardStates(scheduler)).toBe(0);

    const before = repos.cards.getById(cardId)?.due;
    const lower = createScheduler({ desiredRetention: 0.8 });
    expect(repos.alignCardStates(lower)).toBe(1);
    const after = repos.cards.getById(cardId);
    expect(after?.due).not.toEqual(before);
    expect(after && toSchedule(after)).toEqual(
      rebuildCardState(repos.reviewLogs.listForCard(cardId), { scheduler: lower }),
    );
    expect(repos.alignCardStates(lower)).toBe(0);
  });
});
