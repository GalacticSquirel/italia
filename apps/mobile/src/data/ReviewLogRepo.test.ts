import { createScheduler } from '@italia/core';

import {
  createTestDatabase,
  sequentialIds,
  type TestDatabase,
} from '@/db/testing/createTestDatabase';

import { CardNotFoundError, toSchedule } from './CardRepo';
import { createRepositories, type Repositories } from './repositories';
import type { ReviewLogRepo } from './ReviewLogRepo';
import { at, schedule } from './testing/fixtures';

let t: TestDatabase;
let repos: Repositories;
let cardId: string;

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

const review = (minutes: number, id?: string) => ({
  ...(id === undefined ? {} : { id }),
  cardId,
  rating: 'good' as const,
  answer: 'casa',
  latencyMs: 1200,
  reviewedAt: at(minutes),
  deviceId: 'device-a',
});

describe('ReviewLogRepo', () => {
  it('exposes no way to update or delete rows', () => {
    const methods = Object.keys(repos.reviewLogs).sort();
    expect(methods).toEqual(
      [
        'append',
        'count',
        'countCardsFirstReviewedBetween',
        'getById',
        'listForCard',
        'listRecent',
        'listSince',
        'listUnsynced',
        'markSynced',
      ].sort(),
    );
    type Mutators = Extract<keyof ReviewLogRepo, `${'update' | 'delete' | 'remove'}${string}`>;
    const _typeCheck: [Mutators] extends [never] ? true : never = true;
    expect(_typeCheck).toBe(true);
  });

  it('rejects updates of anything but synced_at at the database level', () => {
    const row = repos.reviewLogs.append(review(1));
    expect(() =>
      t.sqlite.prepare(`UPDATE review_log SET rating = 'again' WHERE id = ?`).run(row.id),
    ).toThrow(/append-only/);
    expect(() =>
      t.sqlite.prepare(`UPDATE review_log SET reviewed_at = 0 WHERE id = ?`).run(row.id),
    ).toThrow(/append-only/);
    expect(repos.reviewLogs.getById(row.id)?.rating).toBe('good');
    expect(() => repos.reviewLogs.append(review(2, row.id))).toThrow();
    expect(repos.reviewLogs.count()).toBe(1);
  });

  it('pages through the log in (reviewedAt, id) order with a cursor', () => {
    repos.reviewLogs.append(review(5, 'c'));
    repos.reviewLogs.append(review(1, 'b'));
    repos.reviewLogs.append(review(5, 'a'));
    repos.reviewLogs.append(review(9, 'd'));

    const first = repos.reviewLogs.listSince(null, 2);
    expect(first.rows.map((r) => r.id)).toEqual(['b', 'a']);
    expect(first.nextCursor).toEqual({ reviewedAt: at(5), id: 'a' });
    const second = repos.reviewLogs.listSince(first.nextCursor, 2);
    expect(second.rows.map((r) => r.id)).toEqual(['c', 'd']);
    const third = repos.reviewLogs.listSince(second.nextCursor, 2);
    expect(third).toEqual({ rows: [], nextCursor: null });
    expect(repos.reviewLogs.listForCard(cardId).map((r) => r.id)).toEqual(['b', 'a', 'c', 'd']);
  });

  it('uses an index for cursor paging', () => {
    const plan = t.sqlite
      .prepare(
        'EXPLAIN QUERY PLAN SELECT * FROM review_log WHERE (reviewed_at, id) > (?, ?) ORDER BY reviewed_at, id LIMIT 100',
      )
      .all(0, '') as { detail: string }[];
    const details = plan.map((p) => p.detail).join('\n');
    expect(details).toContain('review_log_reviewed_id_idx');
    expect(details).not.toContain('TEMP B-TREE');
  });

  it('marks rows synced once and lists the rest as unsynced', () => {
    const a = repos.reviewLogs.append(review(1));
    const b = repos.reviewLogs.append(review(2));
    expect(repos.reviewLogs.listUnsynced(10).map((r) => r.id)).toEqual([a.id, b.id]);
    expect(repos.reviewLogs.markSynced([a.id, a.id, 'missing'], at(10))).toBe(1);
    expect(repos.reviewLogs.markSynced([a.id], at(20))).toBe(0);
    expect(repos.reviewLogs.getById(a.id)?.syncedAt).toEqual(at(10));
    expect(repos.reviewLogs.listUnsynced(10).map((r) => r.id)).toEqual([b.id]);
    expect(repos.reviewLogs.markSynced([], at(30))).toBe(0);
  });
});

describe('ReviewLogRepo queries for planning', () => {
  it('lists recent reviews newest first, optionally without some card kinds', () => {
    const other = repos.cards.create({
      kind: 'recognition',
      targetId: 1,
      promptMode: 'typed',
      schedule: schedule(),
    }).id;
    repos.reviewLogs.append(review(1, 'a'));
    repos.reviewLogs.append({ ...review(2, 'b'), cardId: other });
    repos.reviewLogs.append(review(3, 'c'));
    expect(repos.reviewLogs.listRecent(2).map((r) => r.id)).toEqual(['c', 'b']);
    expect(
      repos.reviewLogs.listRecent(5, { excludeKinds: ['recognition'] }).map((r) => r.id),
    ).toEqual(['c', 'a']);
  });

  it('counts cards by the time of their first review', () => {
    const other = repos.cards.create({
      kind: 'dictation',
      targetId: 2,
      promptMode: 'typed',
      schedule: schedule(),
    }).id;
    repos.reviewLogs.append(review(10, 'a'));
    repos.reviewLogs.append(review(100, 'b'));
    repos.reviewLogs.append({ ...review(60, 'c'), cardId: other });
    expect(repos.reviewLogs.countCardsFirstReviewedBetween(at(0), at(50))).toBe(1);
    expect(repos.reviewLogs.countCardsFirstReviewedBetween(at(50), at(200))).toBe(1);
    expect(repos.reviewLogs.countCardsFirstReviewedBetween(at(0), at(200))).toBe(2);
    expect(
      repos.reviewLogs.countCardsFirstReviewedBetween(at(0), at(200), { kinds: ['dictation'] }),
    ).toBe(1);
    expect(repos.reviewLogs.countCardsFirstReviewedBetween(at(0), at(200), { kinds: [] })).toBe(0);
  });
});

describe('recordReview', () => {
  it('appends the log and updates the card in one step', () => {
    const scheduler = createScheduler();
    const current = repos.cards.getById(cardId);
    if (!current) throw new Error('card missing');
    const { card: next } = scheduler.review(toSchedule(current), 'good', at(1));

    const log = repos.recordReview({ ...review(1), next });
    expect(log.cardId).toBe(cardId);
    expect(repos.reviewLogs.count()).toBe(1);
    const updated = repos.cards.getById(cardId);
    expect(updated && toSchedule(updated)).toEqual(next);
  });

  it('keeps neither write when the card does not exist', () => {
    expect(() =>
      repos.recordReview({ ...review(1), cardId: 'missing', next: schedule({ reps: 1 }) }),
    ).toThrow(CardNotFoundError);
    expect(repos.reviewLogs.count()).toBe(0);
  });

  it('rolls back the card update when the log insert fails', () => {
    repos.reviewLogs.append(review(1, 'dup'));
    const before = repos.cards.getById(cardId);
    expect(() =>
      repos.recordReview({
        ...review(2),
        logId: 'dup',
        next: schedule({ reps: 5, state: 'review' }),
      }),
    ).toThrow();
    expect(repos.cards.getById(cardId)).toEqual(before);
  });
});
