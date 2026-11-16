import { describe, expect, it } from 'vitest';

import {
  buildSession,
  CARD_KINDS,
  createRng,
  createScheduler,
  currentEntry,
  DEFAULT_SECONDS_PER_ITEM,
  estimateItemSeconds,
  interleaveItems,
  projectedLoad,
  recordAnswer,
  startSessionQueue,
  type CardKind,
  type CardSchedule,
  type NewCandidate,
  type SessionCard,
  type SessionItem,
  type SessionQueue,
} from './index';

const NOW = new Date('2026-03-01T08:00:00.000Z');
const DAY = 86_400_000;
const scheduler = createScheduler();

/** A review-state card last reviewed `daysAgo` days ago with the given stability. */
function reviewCard(daysAgo: number, stability = 5, dueInDays = 0): CardSchedule {
  return {
    due: new Date(NOW.getTime() + dueInDays * DAY),
    stability,
    difficulty: 5,
    scheduledDays: Math.max(1, Math.round(daysAgo + dueInDays)),
    learningSteps: 0,
    reps: 4,
    lapses: 0,
    state: 'review',
    lastReview: new Date(NOW.getTime() - daysAgo * DAY),
  };
}

function card(
  id: string,
  overrides: Partial<SessionCard> = {},
  schedule: CardSchedule = reviewCard(5),
): SessionCard {
  return { id, kind: 'cloze_production', schedule, grammarIds: [], lemmaIds: [], ...overrides };
}

function candidates(count: number, kind: CardKind = 'cloze_production'): NewCandidate[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `new-${i}`,
    kind,
    grammarIds: [],
    lemmaIds: [1000 + i],
  }));
}

function adjacentClashes(
  items: readonly Pick<SessionItem, 'lemmaIds' | 'grammarIds'>[],
  key: 'lemmaIds' | 'grammarIds',
): number {
  let clashes = 0;
  for (let i = 1; i < items.length; i++) {
    const prev = new Set(items[i - 1]?.[key]);
    if (items[i]?.[key].some((id) => prev.has(id))) clashes++;
  }
  return clashes;
}

describe('estimateItemSeconds', () => {
  it('has a positive estimate for every kind and charges more for new items', () => {
    for (const kind of CARD_KINDS) {
      expect(DEFAULT_SECONDS_PER_ITEM[kind]).toBeGreaterThan(0);
      expect(estimateItemSeconds(kind, 'new')).toBeGreaterThan(estimateItemSeconds(kind, 'review'));
    }
    expect(estimateItemSeconds('sentence_production', 'review')).toBeGreaterThan(
      estimateItemSeconds('recognition', 'review'),
    );
  });
});

describe('projectedLoad', () => {
  it('counts overdue cards on day 0 and future due cards on their day', () => {
    const forecast = projectedLoad({
      now: NOW,
      cards: [
        { kind: 'cloze_production', schedule: reviewCard(10, 5, -2) },
        { kind: 'recognition', schedule: reviewCard(1, 30, 3.5) },
      ],
      days: 7,
    });
    expect(forecast.days).toHaveLength(7);
    expect(forecast.days[0]?.reviews).toBe(1);
    expect(forecast.days[3]?.reviews).toBe(1);
    expect(forecast.days[3]?.seconds).toBe(DEFAULT_SECONDS_PER_ITEM.recognition);
    expect(forecast.totalReviews).toBe(forecast.days.reduce((n, d) => n + d.reviews, 0));
    expect(forecast.totalSeconds).toBe(forecast.days.reduce((n, d) => n + d.seconds, 0));
  });

  it('simulates later reviews of a card within the horizon', () => {
    const { card: learning } = scheduler.review(scheduler.newCard(NOW), 'good', NOW);
    const forecast = projectedLoad({
      now: NOW,
      cards: [{ kind: 'cloze_production', schedule: learning }],
      days: 30,
    });
    expect(forecast.totalReviews).toBeGreaterThan(2);
  });

  it('ignores new and minimal-pair cards and cards beyond the horizon', () => {
    const forecast = projectedLoad({
      now: NOW,
      cards: [
        { kind: 'cloze_production', schedule: scheduler.newCard(NOW) },
        { kind: 'minimal_pair', schedule: reviewCard(5) },
        { kind: 'cloze_production', schedule: reviewCard(1, 100, 20) },
      ],
      days: 7,
    });
    expect(forecast.totalReviews).toBe(0);
  });

  it('rejects a bad horizon', () => {
    expect(() => projectedLoad({ now: NOW, cards: [], days: 0 })).toThrow(RangeError);
    expect(() => projectedLoad({ now: NOW, cards: [], days: 1.5 })).toThrow(RangeError);
  });
});

describe('interleaveItems', () => {
  const tagged = (id: string, kind: CardKind, lemma: number, grammar: number) => ({
    id,
    kind,
    lemmaIds: [lemma],
    grammarIds: [grammar],
  });

  it('returns a permutation of its input', () => {
    const items = [tagged('a', 'recognition', 1, 1), tagged('b', 'recognition', 1, 1)];
    expect(
      interleaveItems(items)
        .map((i) => i.id)
        .sort(),
    ).toEqual(['a', 'b']);
  });

  it('separates items that share a lemma, grammar point or kind', () => {
    const items = [
      tagged('a1', 'grammar_cloze', 1, 10),
      tagged('a2', 'grammar_cloze', 1, 10),
      tagged('a3', 'grammar_cloze', 1, 10),
      tagged('b1', 'cloze_production', 2, 20),
      tagged('b2', 'cloze_production', 2, 20),
      tagged('b3', 'cloze_production', 2, 20),
      tagged('c1', 'recognition', 3, 30),
      tagged('c2', 'recognition', 3, 30),
      tagged('c3', 'recognition', 3, 30),
    ];
    const out = interleaveItems(items);
    expect(adjacentClashes(out, 'lemmaIds')).toBe(0);
    expect(adjacentClashes(out, 'grammarIds')).toBe(0);
    for (let i = 1; i < out.length; i++) {
      expect(out[i]?.kind).not.toBe(out[i - 1]?.kind);
    }
  });

  it('never has more adjacent clashes than the input order (random inputs)', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = createRng(seed);
      const n = 5 + Math.floor(rng() * 40);
      const items = Array.from({ length: n }, (_, i) =>
        tagged(
          `i${i}`,
          CARD_KINDS[Math.floor(rng() * 3)] ?? 'recognition',
          Math.floor(rng() * 6),
          Math.floor(rng() * 4),
        ),
      );
      const out = interleaveItems(items);
      expect(out).toHaveLength(n);
      expect(new Set(out.map((i) => i.id)).size).toBe(n);
      expect(adjacentClashes(out, 'lemmaIds')).toBeLessThanOrEqual(
        adjacentClashes(items, 'lemmaIds'),
      );
    }
  });
});

describe('buildSession', () => {
  it('puts due reviews first, then new items up to the daily cap', () => {
    const cards = [card('r1'), card('r2'), card('later', {}, reviewCard(1, 30, 5))];
    const plan = buildSession({ now: NOW, cards, newCandidates: candidates(30), seed: 1 });
    expect(plan.reviewCount).toBe(2);
    expect(plan.newCount).toBe(20);
    expect(plan.items.slice(0, 2).every((i) => i.source === 'review')).toBe(true);
    expect(plan.items.slice(2).every((i) => i.source === 'new')).toBe(true);
    expect(plan.items.map((i) => i.cardId)).not.toContain('later');
    expect(plan.newItems.limitedBy).toEqual(['daily_limit']);
  });

  it('keeps new items in curriculum order', () => {
    const plan = buildSession({ now: NOW, cards: [], newCandidates: candidates(5), seed: 1 });
    expect(plan.items.map((i) => i.cardId)).toEqual(['new-0', 'new-1', 'new-2', 'new-3', 'new-4']);
    expect(plan.newItems.limitedBy).toEqual([]);
  });

  it('subtracts items already introduced today', () => {
    const plan = buildSession({
      now: NOW,
      cards: [],
      newCandidates: candidates(30),
      settings: { alreadyIntroducedToday: 15 },
      seed: 1,
    });
    expect(plan.newCount).toBe(5);
    const none = buildSession({
      now: NOW,
      cards: [],
      newCandidates: candidates(30),
      settings: { alreadyIntroducedToday: 25 },
      seed: 1,
    });
    expect(none.newCount).toBe(0);
  });

  it('halves new items when recent accuracy is under 80%', () => {
    const plan = buildSession({
      now: NOW,
      cards: [],
      newCandidates: candidates(30),
      settings: { recentAccuracy: 0.75 },
      seed: 1,
    });
    expect(plan.newCount).toBe(10);
    expect(plan.newItems.limitedBy).toContain('low_accuracy');

    const ok = buildSession({
      now: NOW,
      cards: [],
      newCandidates: candidates(30),
      settings: { recentAccuracy: 0.8 },
      seed: 1,
    });
    expect(ok.newCount).toBe(20);
  });

  it('throttles new items when the 7-day projected load exceeds the time budget', () => {
    // 300 cards due over the coming week at 10 s each is 50 min, over a 5-minute-a-day budget.
    const cards = Array.from({ length: 300 }, (_, i) =>
      card(`r${i}`, {}, reviewCard(3, 10, 1 + (i % 6))),
    );
    const plan = buildSession({
      now: NOW,
      cards,
      newCandidates: candidates(20),
      settings: { minutesBudget: 5 },
      seed: 1,
    });
    expect(plan.newCount).toBe(0);
    expect(plan.newItems.limitedBy).toContain('review_load');
    expect(plan.forecast.totalSeconds).toBeGreaterThan(5 * 60 * 7);
  });

  it('fits reviews into the time budget, most urgent first, and defers the rest', () => {
    const cards = [
      ...Array.from({ length: 100 }, (_, i) => card(`fresh${i}`, {}, reviewCard(2, 20))),
      card('urgent', {}, reviewCard(60, 2)),
    ];
    const plan = buildSession({
      now: NOW,
      cards,
      newCandidates: candidates(5),
      settings: { minutesBudget: 2 },
      seed: 1,
    });
    expect(plan.estimatedSeconds).toBeLessThanOrEqual(120);
    expect(plan.reviewCount).toBe(Math.floor(120 / DEFAULT_SECONDS_PER_ITEM.cloze_production));
    expect(plan.deferredReviewCount).toBe(101 - plan.reviewCount);
    expect(plan.items.map((i) => i.cardId)).toContain('urgent');
    expect(plan.newCount).toBe(0);
    expect(plan.newItems.limitedBy).toContain('time_budget');
  });

  it('skips minimal pairs and unintroduced cards', () => {
    const plan = buildSession({
      now: NOW,
      cards: [card('mp', { kind: 'minimal_pair' }), card('n', {}, scheduler.newCard(NOW))],
      newCandidates: [],
      seed: 1,
    });
    expect(plan.items).toEqual([]);
  });

  it('interleaves reviews so the same lemma and grammar point do not cluster', () => {
    const cards = Array.from({ length: 24 }, (_, i) =>
      card(`r${i}`, {
        kind: CARD_KINDS[i % 3] ?? 'recognition',
        lemmaIds: [i % 4],
        grammarIds: [i % 3],
      }),
    );
    const plan = buildSession({ now: NOW, cards, newCandidates: [], seed: 3 });
    expect(adjacentClashes(plan.items, 'lemmaIds')).toBe(0);
  });

  it('is deterministic for a seed', () => {
    const cards = Array.from({ length: 40 }, (_, i) =>
      card(`r${i}`, { lemmaIds: [i % 5], grammarIds: [i % 4] }),
    );
    const a = buildSession({ now: NOW, cards, newCandidates: candidates(5), seed: 9 });
    const b = buildSession({ now: NOW, cards, newCandidates: candidates(5), seed: 9 });
    expect(a).toEqual(b);
    const other = buildSession({ now: NOW, cards, newCandidates: candidates(5), seed: 10 });
    expect(other.items.map((i) => i.cardId).sort()).toEqual(a.items.map((i) => i.cardId).sort());
  });

  it('accepts an injected rng', () => {
    const plan = buildSession({
      now: NOW,
      cards: [card('r1')],
      newCandidates: [],
      rng: createRng(5),
    });
    expect(plan.reviewCount).toBe(1);
  });

  it('rejects invalid settings', () => {
    const base = { now: NOW, cards: [], newCandidates: [], seed: 1 };
    expect(() => buildSession({ ...base, settings: { dailyNewLimit: -1 } })).toThrow(RangeError);
    expect(() => buildSession({ ...base, settings: { minutesBudget: 0 } })).toThrow(RangeError);
    expect(() => buildSession({ ...base, settings: { recentAccuracy: 1.2 } })).toThrow(RangeError);
  });
});

describe('session queue (learning to criterion)', () => {
  const item = (cardId: string, source: SessionItem['source'] = 'review'): SessionItem => ({
    cardId,
    kind: 'cloze_production',
    source,
    grammarIds: [],
    lemmaIds: [],
    estimatedSeconds: 10,
  });
  const ids = (queue: SessionQueue) => queue.pending.map((e) => e.item.cardId);

  it('brings a failed item back after a few others', () => {
    let queue = startSessionQueue(['a', 'b', 'c', 'd', 'e'].map((id) => item(id)));
    expect(currentEntry(queue)?.item.cardId).toBe('a');
    queue = recordAnswer(queue, 'again');
    expect(ids(queue)).toEqual(['b', 'c', 'd', 'a', 'e']);
    expect(queue.pending[3]?.attempt).toBe(2);
    expect(queue.completed).toEqual([{ item: item('a'), attempt: 1, rating: 'again' }]);
  });

  it('appends a failed item when few remain', () => {
    let queue = startSessionQueue([item('a'), item('b')]);
    queue = recordAnswer(queue, 'again');
    expect(ids(queue)).toEqual(['b', 'a']);
  });

  it('retires a correct review', () => {
    let queue = startSessionQueue([item('a'), item('b')]);
    queue = recordAnswer(queue, 'hard');
    expect(ids(queue)).toEqual(['b']);
  });

  it('asks for one more correct recall of a new item unless it was easy', () => {
    let queue = startSessionQueue([item('n', 'new'), item('b'), item('c'), item('d'), item('e')]);
    queue = recordAnswer(queue, 'good');
    expect(ids(queue)).toEqual(['b', 'c', 'd', 'n', 'e']);
    queue = recordAnswer(recordAnswer(recordAnswer(queue, 'good'), 'good'), 'good');
    expect(currentEntry(queue)?.item.cardId).toBe('n');
    queue = recordAnswer(queue, 'good');
    expect(ids(queue)).toEqual(['e']);

    const easy = recordAnswer(startSessionQueue([item('n', 'new')]), 'easy');
    expect(easy.pending).toEqual([]);
  });

  it('gives up on an item after the maximum attempts', () => {
    let queue = startSessionQueue([item('a')]);
    for (let i = 0; i < 3; i++) queue = recordAnswer(queue, 'again', { maxAttempts: 3 });
    expect(queue.pending).toEqual([]);
    expect(queue.completed).toHaveLength(3);
  });

  it('rejects an answer when the queue is empty', () => {
    expect(() => recordAnswer(startSessionQueue([]), 'good')).toThrow(RangeError);
  });
});
