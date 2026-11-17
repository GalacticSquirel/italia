import { describe, expect, it } from 'vitest';

import {
  createRng,
  createScheduler,
  mergeLogs,
  RATINGS,
  rebuildCardState,
  rebuildCardStates,
  shuffle,
  type Rating,
  type ReplayLog,
  type Rng,
} from './index';

const T0 = new Date('2026-02-01T08:00:00.000Z');
const HOUR = 3_600_000;

/** A random but realistic review history for one card. */
function history(cardId: string, rng: Rng, count: number): ReplayLog[] {
  const scheduler = createScheduler();
  let card = scheduler.newCard(T0);
  let now = T0.getTime();
  const logs: ReplayLog[] = [];
  for (let i = 0; i < count; i++) {
    const rating: Rating = RATINGS[Math.floor(rng() * RATINGS.length)] ?? 'good';
    const at = new Date(now);
    logs.push({ id: `${cardId}-${i}`, cardId, rating, reviewedAt: at });
    card = scheduler.review(card, rating, at).card;
    // Review near the due time, sometimes early, sometimes late.
    now = Math.max(now, card.due.getTime() + (rng() - 0.3) * 24 * HOUR);
  }
  return logs;
}

describe('rebuildCardState', () => {
  it('matches applying the reviews one by one', () => {
    const logs = history('c', createRng(1), 12);
    const scheduler = createScheduler();
    let expected = scheduler.newCard(T0);
    for (const log of logs) expected = scheduler.review(expected, log.rating, log.reviewedAt).card;
    expect(rebuildCardState(logs)).toEqual(expected);
  });

  it('gives the same state whatever order the logs arrive in', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const rng = createRng(seed);
      const logs = history('c', rng, 2 + Math.floor(rng() * 20));
      const expected = rebuildCardState(logs);
      expect(rebuildCardState(shuffle(logs, rng))).toEqual(expected);
      expect(rebuildCardState([...logs].reverse())).toEqual(expected);
    }
  });

  it('orders logs with the same time by id', () => {
    const at = new Date(T0.getTime());
    const a: ReplayLog = { id: 'a', cardId: 'c', rating: 'again', reviewedAt: at };
    const b: ReplayLog = { id: 'b', cardId: 'c', rating: 'easy', reviewedAt: at };
    expect(rebuildCardState([b, a])).toEqual(rebuildCardState([a, b]));
  });

  it('returns a new card for no logs when given a creation time', () => {
    expect(rebuildCardState([], { createdAt: T0 })).toEqual(createScheduler().newCard(T0));
    expect(() => rebuildCardState([])).toThrow(RangeError);
  });

  it('rejects logs from more than one card', () => {
    const logs = [...history('a', createRng(2), 2), ...history('b', createRng(3), 2)];
    expect(() => rebuildCardState(logs)).toThrow(RangeError);
  });

  it('does not mutate its input', () => {
    const logs = history('c', createRng(4), 5);
    const copy = structuredClone(logs);
    rebuildCardState(shuffle(logs, createRng(5)));
    expect(logs).toEqual(copy);
  });
});

describe('rebuildCardStates', () => {
  it('rebuilds every card in a mixed log', () => {
    const a = history('a', createRng(6), 4);
    const b = history('b', createRng(7), 6);
    const states = rebuildCardStates(shuffle([...a, ...b], createRng(8)));
    expect([...states.keys()].sort()).toEqual(['a', 'b']);
    expect(states.get('a')).toEqual(rebuildCardState(a));
    expect(states.get('b')).toEqual(rebuildCardState(b));
  });
});

describe('mergeLogs', () => {
  const logs = [
    ...history('a', createRng(9), 8),
    ...history('b', createRng(10), 8),
    ...history('c', createRng(11), 8),
  ];

  it('is a sorted union by id', () => {
    const merged = mergeLogs(logs.slice(0, 15), logs.slice(10));
    expect(merged).toHaveLength(logs.length);
    expect(new Set(merged.map((l) => l.id)).size).toBe(logs.length);
    for (let i = 1; i < merged.length; i++) {
      const prev = merged[i - 1];
      const cur = merged[i];
      if (prev === undefined || cur === undefined) throw new Error('unreachable');
      const order =
        prev.reviewedAt.getTime() - cur.reviewedAt.getTime() || (prev.id < cur.id ? -1 : 1);
      expect(order).toBeLessThan(0);
    }
  });

  it('is commutative, associative and idempotent', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const rng = createRng(seed);
      const pick = () => logs.filter(() => rng() < 0.5);
      const [x, y, z] = [pick(), pick(), pick()];
      expect(mergeLogs(x, y)).toEqual(mergeLogs(y, x));
      expect(mergeLogs(mergeLogs(x, y), z)).toEqual(mergeLogs(x, mergeLogs(y, z)));
      expect(mergeLogs(x, x)).toEqual(mergeLogs(x, []));
    }
  });

  it('lets two devices converge on the same card state', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const rng = createRng(seed);
      const all = history('c', rng, 15);
      const deviceA = all.filter(() => rng() < 0.6);
      const deviceB = all.filter((log) => !deviceA.includes(log) || rng() < 0.3);
      const onA = rebuildCardState(mergeLogs(deviceA, deviceB));
      const onB = rebuildCardState(mergeLogs(deviceB, deviceA));
      expect(onA).toEqual(onB);
      expect(onA).toEqual(rebuildCardState(all));
    }
  });
});
