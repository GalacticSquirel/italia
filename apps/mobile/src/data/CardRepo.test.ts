import { createScheduler } from '@italia/core';

import {
  createTestDatabase,
  sequentialIds,
  type TestDatabase,
} from '@/db/testing/createTestDatabase';

import { CardNotFoundError, toSchedule } from './CardRepo';
import { cardIdFor } from './ids';
import { createRepositories, type Repositories } from './repositories';
import { at, schedule, T0 } from './testing/fixtures';

let t: TestDatabase;
let repos: Repositories;

beforeEach(() => {
  t = createTestDatabase();
  repos = createRepositories(t.db, { newId: sequentialIds() });
});

afterEach(() => {
  t.close();
});

describe('CardRepo', () => {
  it('creates cards with deterministic ids and is idempotent', () => {
    const input = {
      kind: 'cloze_production',
      targetId: 7,
      promptMode: 'typed',
      schedule: schedule(),
    } as const;
    const first = repos.cards.create(input);
    expect(first.id).toBe(cardIdFor('cloze_production', 7, 'typed'));
    const again = repos.cards.create({ ...input, schedule: schedule({ reps: 9 }) });
    expect(again).toEqual(first);
    expect(repos.cards.getByTarget('cloze_production', 7)).toHaveLength(1);
  });

  it('returns due cards most overdue first, excluding new and suspended cards', () => {
    const mk = (targetId: number, dueMin: number, state: 'new' | 'review' | 'learning') =>
      repos.cards.create({
        kind: 'cloze_production',
        targetId,
        promptMode: 'typed',
        schedule: schedule({ due: at(dueMin), state, reps: state === 'new' ? 0 : 1 }),
      }).id;
    const a = mk(1, 30, 'review');
    const b = mk(2, -60, 'review');
    const c = mk(3, 0, 'learning');
    mk(4, -120, 'new');
    const suspended = mk(5, -500, 'review');
    mk(6, 120, 'review'); // not yet due
    repos.cards.suspend(suspended);

    const due = repos.cards.getDue(at(60), 10).map((r) => r.id);
    expect(due).toEqual([b, c, a]);
    expect(repos.cards.getDue(at(60), 2).map((r) => r.id)).toEqual([b, c]);
    expect(repos.cards.countDue(at(60))).toBe(3);
    expect(repos.cards.getNew(10).map((r) => r.targetId)).toEqual([4]);
  });

  it('breaks ties in due time by id', () => {
    for (const targetId of [3, 1, 2]) {
      repos.cards.create({
        kind: 'dictation',
        targetId,
        promptMode: 'typed',
        schedule: schedule({ state: 'review', reps: 1 }),
      });
    }
    expect(repos.cards.getDue(T0, 10).map((r) => r.targetId)).toEqual([1, 2, 3]);
  });

  it('uses an index for the due query', () => {
    const plan = t.sqlite
      .prepare(
        `EXPLAIN QUERY PLAN SELECT * FROM card WHERE suspended = 0 AND due <= ? AND state != 'new' ORDER BY due, id LIMIT 20`,
      )
      .all(Date.now()) as { detail: string }[];
    const details = plan.map((p) => p.detail).join('\n');
    expect(details).toContain('card_due_order_idx');
    expect(details).not.toContain('TEMP B-TREE');
  });

  it('replaces FSRS state and round-trips it through toSchedule', () => {
    const { id } = repos.cards.create({
      kind: 'grammar_cloze',
      targetId: 1,
      promptMode: 'typed',
      schedule: schedule(),
    });
    const next = createScheduler().review(schedule(), 'good', at(1)).card;
    repos.cards.upsertState(id, next);
    const row = repos.cards.getById(id);
    expect(row && toSchedule(row)).toEqual(next);
    expect(() => {
      repos.cards.upsertState('missing', next);
    }).toThrow(CardNotFoundError);
  });

  it('suspends, unsuspends and counts by state', () => {
    const ids = repos.cards
      .createMany([
        { kind: 'dictation', targetId: 1, promptMode: 'typed', schedule: schedule() },
        {
          kind: 'dictation',
          targetId: 2,
          promptMode: 'typed',
          schedule: schedule({ state: 'review' }),
        },
        {
          kind: 'dictation',
          targetId: 3,
          promptMode: 'spoken',
          schedule: schedule({ state: 'review' }),
        },
      ])
      .map((c) => c.id);
    const [, second, third] = ids;
    if (second === undefined || third === undefined) throw new Error('expected three cards');
    repos.cards.suspend(third);
    expect(repos.cards.countsByState()).toEqual({
      new: 1,
      learning: 0,
      review: 1,
      relearning: 0,
      suspended: 1,
      total: 3,
    });
    repos.cards.suspend(third, false);
    expect(repos.cards.countsByState().review).toBe(2);
    expect(() => {
      repos.cards.suspend('nope');
    }).toThrow(CardNotFoundError);
    expect(repos.cards.getById(second)?.suspended).toBe(false);
  });
});
