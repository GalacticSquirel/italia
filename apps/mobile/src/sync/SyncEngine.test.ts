import { randomUUID } from 'node:crypto';

import { createScheduler, rebuildCardState, type CardKind, type Rating } from '@italia/core';

import { toSchedule } from '@/data/CardRepo';
import { cardIdFor } from '@/data/ids';
import { META_KEYS } from '@/data/MetaRepo';
import { createRepositories, type Repositories } from '@/data/repositories';
import { createTestDatabase, type TestDatabase } from '@/db/testing/createTestDatabase';

import { parseCardId } from './localStore';
import { SyncEngine, type SyncEngineOptions, type SyncResult } from './SyncEngine';
import { FakeSyncServer, type FakeTransport } from './testing/FakeSyncServer';

const T0 = Date.parse('2026-11-01T08:00:00.000Z');
const at = (minutes: number) => new Date(T0 + minutes * 60_000);
const USER = 'user-1';
const scheduler = createScheduler();

interface Device {
  name: string;
  t: TestDatabase;
  repos: Repositories;
  transport: FakeTransport;
  engine: SyncEngine;
  user: string | null;
}

let server: FakeSyncServer;
const open: Device[] = [];

function device(name: string, options: Partial<SyncEngineOptions> = {}): Device {
  const t = createTestDatabase();
  const repos = createRepositories(t.db, { newId: randomUUID });
  repos.meta.set(META_KEYS.deviceId, `device-${name}`);
  const d = { name, t, repos, user: USER } as Device;
  d.transport = server.transport(() => d.user);
  d.engine = new SyncEngine({
    db: t.db,
    transport: d.transport,
    now: () => at(10_000),
    streakConfig: { localDate: (x) => x.toISOString().slice(0, 10) },
    yieldToUi: () => Promise.resolve(),
    timers: { setTimeout: () => 0, clearTimeout: () => undefined },
    random: () => 0.5,
    ...options,
  });
  open.push(d);
  return d;
}

beforeEach(() => {
  server = new FakeSyncServer();
});

afterEach(() => {
  for (const d of open.splice(0)) {
    d.engine.dispose();
    d.t.close();
  }
});

function makeCard(
  d: Device,
  targetId: number,
  createdAt: Date,
  kind: CardKind = 'cloze_production',
) {
  return d.repos.cards.create({
    kind,
    targetId,
    promptMode: 'typed',
    schedule: scheduler.newCard(createdAt),
    createdAt,
  }).id;
}

function review(d: Device, cardId: string, rating: Rating, when: Date) {
  const current = d.repos.cards.getById(cardId);
  if (!current) throw new Error(`no card ${cardId}`);
  const next = scheduler.review(toSchedule(current), rating, when).card;
  return d.repos.recordReview({
    cardId,
    rating,
    answer: null,
    latencyMs: 1500,
    reviewedAt: when,
    deviceId: `device-${d.name}`,
    next,
  });
}

function cardOf(d: Device, id: string) {
  const row = d.repos.cards.getById(id);
  if (!row) throw new Error(`no card ${id}`);
  return row;
}

function cardStates(d: Device) {
  return d.t.db.query.card
    .findMany({ orderBy: (c, { asc }) => [asc(c.id)] })
    .sync()
    .map(({ createdAt: _c, flagSyncedAt: _s, flagDeviceId: _d, ...rest }) => rest);
}

function expectOk(result: SyncResult): Extract<SyncResult, { status: 'ok' }> {
  if (result.status !== 'ok') {
    throw new Error(`sync did not succeed: ${JSON.stringify(result)}`);
  }
  return result;
}

describe('SyncEngine', () => {
  it('does nothing while signed out', async () => {
    const a = device('a');
    a.user = null;
    makeCard(a, 1, at(0));
    expect(await a.engine.sync()).toEqual({ status: 'skipped', reason: 'signed_out' });
    expect(a.transport.pushCalls).toHaveLength(0);
    expect(a.engine.status.state).toBe('signed_out');
  });

  it('makes two devices converge on the same card states', async () => {
    const a = device('a');
    const b = device('b');
    const c1 = makeCard(a, 1, at(0));
    const c2 = makeCard(a, 2, at(0));
    makeCard(b, 1, at(30)); // same card, created later and independently on B
    review(a, c1, 'good', at(60));
    review(b, c1, 'again', at(90));
    review(a, c1, 'hard', at(24 * 60));
    review(b, c1, 'good', at(2 * 24 * 60));
    review(a, c2, 'easy', at(61));
    a.repos.cards.suspend(c2, true, at(70));

    expectOk(await a.engine.sync());
    const fromB = expectOk(await b.engine.sync());
    expect(fromB.pulled.review_log).toBe(5); // 3 of A's and B's own 2 echoed back
    expect(fromB.rebuiltCards).toBe(2);
    const fromA = expectOk(await a.engine.sync());
    expect(fromA.applied).toBe(2);

    expect(cardStates(a)).toEqual(cardStates(b));
    expect(b.repos.cards.getById(c2)?.suspended).toBe(true);

    // The converged state is exactly the replay of the union of logs.
    const logs = a.repos.reviewLogs.listForCard(c1);
    expect(logs).toHaveLength(4);
    expect(toSchedule(cardOf(a, c1))).toEqual(rebuildCardState(logs));
    expect(b.repos.reviewLogs.count()).toBe(5);
  });

  it('pushes each row once and treats re-pushes as no-ops', async () => {
    const a = device('a');
    const c1 = makeCard(a, 1, at(0));
    for (let i = 0; i < 3; i++) review(a, c1, 'good', at(60 * (i + 1)));
    expect(expectOk(await a.engine.sync()).pushed.review_log).toBe(3);
    const again = expectOk(await a.engine.sync());
    expect(again.pushed.review_log).toBe(0);

    // A push whose response was lost: rows are still unsynced locally.
    a.t.sqlite.prepare('UPDATE review_log SET synced_at = NULL').run();
    expect(expectOk(await a.engine.sync()).pushed.review_log).toBe(3);
    expect(server.rows(USER, 'review_log')).toHaveLength(3);
    expect(a.repos.reviewLogs.count()).toBe(3);
  });

  it('resumes after a push fails part-way', async () => {
    const a = device('a', { batchSize: 200 });
    const c1 = makeCard(a, 1, at(0));
    for (let i = 0; i < 450; i++) review(a, c1, 'good', at(i + 1));
    a.transport.failures = { pushNumber: 2 };

    const failed = await a.engine.sync();
    expect(failed.status).toBe('error');
    expect(a.engine.status).toMatchObject({ state: 'error', lastError: 'push failed' });
    expect(server.rows(USER, 'review_log')).toHaveLength(200);
    expect(a.repos.reviewLogs.listUnsynced(1000)).toHaveLength(250);

    const resumed = expectOk(await a.engine.sync());
    expect(resumed.pushed.review_log).toBe(250);
    expect(server.rows(USER, 'review_log')).toHaveLength(450);
    expect(new Set(server.rows(USER, 'review_log').map((r) => r.id)).size).toBe(450);
    expect(a.transport.pushCalls.every((c) => c.rows.length <= 200)).toBe(true);
  });

  it('resumes after a pull fails part-way without losing or repeating rows', async () => {
    const a = device('a');
    const c1 = makeCard(a, 1, at(0));
    for (let i = 0; i < 25; i++) review(a, c1, 'good', at(i + 1));
    expectOk(await a.engine.sync());

    const b = device('b', { batchSize: 10 });
    // setting, learner_sentence, card_flag, then review_log pages 1 and 2
    b.transport.failures = { pullNumber: 5 };
    expect((await b.engine.sync()).status).toBe('error');
    expect(b.repos.reviewLogs.count()).toBe(10);
    expect(b.repos.meta.get(META_KEYS.syncCursorReviewLog)).toBe('10');
    expect(b.repos.cards.getById(c1)?.reps).toBe(10);

    expectOk(await b.engine.sync());
    expect(b.repos.reviewLogs.count()).toBe(25);
    expect(cardStates(b)).toEqual(cardStates(a));
    const afters = b.transport.pullCalls
      .filter((c) => c.table === 'review_log')
      .map((c) => c.after);
    expect(afters).toEqual([0, 10, 10, 20]);
  });

  it('resolves settings last-writer-wins per key', async () => {
    const a = device('a');
    const b = device('b');
    a.repos.settings.set('theme', 'dark', at(1));
    a.repos.settings.set('dailyNewLimit', 10, at(5));
    b.repos.settings.set('theme', 'light', at(2)); // newer than A's theme
    b.repos.settings.set('dailyNewLimit', 30, at(3)); // older than A's limit

    expectOk(await a.engine.sync());
    expectOk(await b.engine.sync());
    expectOk(await a.engine.sync());

    for (const d of [a, b]) {
      expect(d.repos.settings.get('theme')).toBe('light');
      expect(d.repos.settings.get('dailyNewLimit')).toBe(10);
    }

    // Equal times: the larger device id wins everywhere.
    a.repos.settings.set('speechRate', 0.75, at(9));
    b.repos.settings.set('speechRate', 1.25, at(9));
    expectOk(await a.engine.sync());
    expectOk(await b.engine.sync());
    expectOk(await a.engine.sync());
    expect(a.repos.settings.get('speechRate')).toBe(1.25);
    expect(b.repos.settings.get('speechRate')).toBe(1.25);
  });

  it('keeps a local change made while its push was in flight', async () => {
    const a = device('a');
    a.repos.settings.set('theme', 'dark', at(1));
    const push = a.transport.push.bind(a.transport);
    a.transport.push = async (request) => {
      await push(request);
      if (request.table === 'setting') a.repos.settings.set('theme', 'light', at(2));
    };
    expectOk(await a.engine.sync());
    expect(a.repos.settings.get('theme')).toBe('light');
    expect(expectOk(await a.engine.sync()).pushed.setting).toBe(1);
    expect(server.rows(USER, 'setting')[0]?.value).toBe('light');
  });

  it('rebuilds every card when the desired retention arrives from another device', async () => {
    const a = device('a');
    const b = device('b');
    const c1 = makeCard(a, 1, at(0));
    review(a, c1, 'good', at(1));
    review(a, c1, 'good', at(20));
    review(a, c1, 'good', at(3 * 24 * 60));
    expectOk(await a.engine.sync());
    expectOk(await b.engine.sync());
    const before = b.repos.cards.getById(c1)?.due;

    a.repos.settings.set('desiredRetention', 0.8, at(5));
    expectOk(await a.engine.sync());
    const result = expectOk(await b.engine.sync());
    expect(result.rebuiltCards).toBe(1);
    const after = b.repos.cards.getById(c1);
    expect(after?.due).not.toEqual(before);
    const logs = b.repos.reviewLogs.listForCard(c1);
    expect(toSchedule(cardOf(b, c1))).toEqual(
      rebuildCardState(logs, { scheduler: createScheduler({ desiredRetention: 0.8 }) }),
    );
  });

  it('keeps the changing device in step with the others after a retention change', async () => {
    const a = device('a');
    const b = device('b');
    const c1 = makeCard(a, 1, at(0));
    review(a, c1, 'good', at(1));
    review(a, c1, 'good', at(20));
    review(a, c1, 'good', at(3 * 24 * 60));
    expectOk(await a.engine.sync());
    expectOk(await b.engine.sync());

    // A changes the retention locally; its next plan aligns its own cards.
    a.repos.settings.set('desiredRetention', 0.8, at(5));
    const lower = createScheduler({ desiredRetention: 0.8 });
    expect(a.repos.alignCardStates(lower)).toBe(1);
    expect(a.repos.alignCardStates(lower)).toBe(0); // already aligned
    expectOk(await a.engine.sync());
    expectOk(await b.engine.sync());
    expect(cardStates(a)).toEqual(cardStates(b));
  });

  it("applies a review older than the card's last one by replaying (clock skew)", async () => {
    const a = device('a');
    const b = device('b');
    const c1 = makeCard(a, 1, at(0));
    review(a, c1, 'good', at(60));
    // A's clock runs a day ahead.
    review(a, c1, 'good', at(2 * 24 * 60));
    expectOk(await a.engine.sync());
    expectOk(await b.engine.sync());
    // B reviews "now" by its own clock, earlier than A's last review.
    const { card: updated } = b.repos.reviewCard({
      cardId: c1,
      rating: 'again',
      answer: null,
      latencyMs: 1000,
      reviewedAt: at(24 * 60),
      deviceId: 'device-b',
      scheduler,
    });
    const logs = b.repos.reviewLogs.listForCard(c1);
    expect(logs.map((l) => l.rating)).toEqual(['good', 'again', 'good']);
    expect(toSchedule(updated)).toEqual(rebuildCardState(logs));
    expectOk(await b.engine.sync());
    expectOk(await a.engine.sync());
    expect(cardStates(a)).toEqual(cardStates(b));
  });

  it('syncs reviews of cards for sentences corrected in conversation', async () => {
    const a = device('a');
    const b = device('b');
    const c1 = makeCard(a, -123_456, at(0), 'sentence_production');
    review(a, c1, 'good', at(1));
    expectOk(await a.engine.sync());
    const result = expectOk(await b.engine.sync());
    expect(result.applied).toBe(1);
    expect(b.repos.cards.getById(c1)).toMatchObject({
      kind: 'sentence_production',
      targetId: -123_456,
    });
    expect(cardStates(b)).toEqual(cardStates(a));
  });

  it('syncs the corrected sentences themselves, so other devices can show their cards', async () => {
    const a = device('a');
    const b = device('b');
    const sentence = a.repos.learnerSentences.add({
      it: 'Ieri sono andata a Napoli.',
      original: 'Ieri ho andato a Napoli.',
      errorTags: ['aux.essere'],
      grammarIds: [12],
      source: 'conversation',
      createdAt: at(0),
    });
    const c1 = makeCard(a, sentence.id, at(0), 'sentence_production');
    review(a, c1, 'good', at(1));

    const pushed = expectOk(await a.engine.sync());
    expect(pushed.pushed.learner_sentence).toBe(1);
    expect(server.rows(USER, 'learner_sentence')).toEqual([
      {
        id: sentence.id,
        it: 'Ieri sono andata a Napoli.',
        original: 'Ieri ho andato a Napoli.',
        errorTags: ['aux.essere'],
        grammarIds: [12],
        source: 'conversation',
        createdAt: at(0).toISOString(),
      },
    ]);
    expect(expectOk(await a.engine.sync()).pushed.learner_sentence).toBe(0);

    expect(b.repos.learnerSentences.getById(sentence.id)).toBeNull();
    const pulled = expectOk(await b.engine.sync());
    expect(pulled.pulled.learner_sentence).toBe(1);
    const { syncedAt: _a, ...onA } = sentence;
    const fromB = b.repos.learnerSentences.getById(sentence.id);
    expect(fromB).toMatchObject({ ...onA, createdAt: at(0) });
    expect(fromB?.syncedAt).not.toBeNull();
    expect(b.repos.cards.getById(c1)?.kind).toBe('sentence_production');

    // B corrected the same sentence on its own: same id, so nothing new to push.
    expect(expectOk(await b.engine.sync()).pushed.learner_sentence).toBe(0);
    const c = device('c');
    c.repos.learnerSentences.add({
      it: 'Ieri sono andata a Napoli.',
      original: 'ieri ho andato a napoli',
      errorTags: [],
      grammarIds: [],
      source: 'conversation',
      createdAt: at(5),
    });
    expectOk(await c.engine.sync());
    expect(server.rows(USER, 'learner_sentence')).toHaveLength(1);
    expect(c.repos.learnerSentences.listAll()).toHaveLength(1);
  });

  it('syncs study sessions once ended, error records, and replays the streak', async () => {
    const a = device('a');
    const b = device('b');
    const c1 = makeCard(a, 1, at(0));
    for (const day of [0, 1, 2]) {
      const s = a.repos.studySessions.start(at(day * 24 * 60));
      a.repos.studySessions.end(s.id, at(day * 24 * 60 + 20), 15);
    }
    const running = a.repos.studySessions.start(at(4 * 24 * 60));
    a.repos.errors.add({
      category: 'agreement.gender',
      example: 'la libro',
      source: 'review',
      cardId: c1,
      createdAt: at(3),
    });
    const pushed = expectOk(await a.engine.sync());
    expect(pushed.pushed.study_session).toBe(3);
    expect(pushed.pushed.error_record).toBe(1);

    const result = expectOk(await b.engine.sync());
    expect(result.streakReplayed).toBe(true);
    expect(b.repos.streak.get()).toMatchObject({ currentDays: 3, lastStudyDate: '2026-11-03' });
    expect(b.repos.errors.listRecent(10)[0]).toMatchObject({ cardId: c1, example: 'la libro' });
    expect(b.repos.cards.getById(c1)).not.toBeNull(); // created from the deterministic id

    a.repos.studySessions.end(running.id, at(4 * 24 * 60 + 30), 20);
    expect(expectOk(await a.engine.sync()).pushed.study_session).toBe(1);
  });

  it('skips rows it cannot push or merge without blocking the rest', async () => {
    const a = device('a');
    const c1 = makeCard(a, 1, at(0));
    a.repos.reviewLogs.append({
      id: 'not-a-uuid',
      cardId: c1,
      rating: 'good',
      answer: null,
      latencyMs: 1,
      reviewedAt: at(1),
      deviceId: 'device-a',
    });
    review(a, c1, 'good', at(2));
    const result = expectOk(await a.engine.sync());
    expect(result.unpushable).toBe(1);
    expect(result.pushed.review_log).toBe(1);

    server.push(USER, {
      table: 'review_log',
      rows: [
        {
          id: randomUUID(),
          cardId: 'hologram_card:1:typed',
          rating: 'good',
          answer: null,
          latencyMs: 1,
          reviewedAt: at(3).toISOString(),
          deviceId: 'device-z',
        },
      ],
    });
    const b = device('b');
    const pulled = expectOk(await b.engine.sync());
    expect(pulled.pulled.review_log).toBe(2);
    expect(pulled.applied).toBe(1);
    expect(b.repos.reviewLogs.count()).toBe(1);
  });

  it('runs one sync at a time and queues one more for requests during a run', async () => {
    const a = device('a');
    const first = a.engine.sync();
    const second = a.engine.sync('session_ended');
    const third = a.engine.sync('foreground');
    expect(second).toBe(first);
    expect(third).toBe(first);
    expectOk(await first);
    // Two runs: the first, and one queued for the requests made during it.
    expect(a.transport.pullCalls.filter((c) => c.table === 'setting')).toHaveLength(2);
  });

  it('retries with exponential backoff and stops once signed out', async () => {
    const scheduled: { fn: () => void; ms: number }[] = [];
    const a = device('a', {
      baseRetryMs: 1000,
      maxRetryMs: 5000,
      timers: {
        setTimeout: (fn, ms) => scheduled.push({ fn, ms }),
        clearTimeout: () => undefined,
      },
    });
    a.transport.offline = true;
    await a.engine.sync();
    await a.engine.sync('retry');
    await a.engine.sync('retry');
    await a.engine.sync('retry');
    // random() = 0.5 gives 75% of the exponential delay, capped at maxRetryMs.
    expect(scheduled.map((s) => s.ms)).toEqual([750, 1500, 3000, 3750]);
    expect(a.engine.status.nextRetryAt).not.toBeNull();

    a.transport.offline = false;
    scheduled.at(-1)?.fn();
    await Promise.resolve();
    await a.engine.sync();
    expect(a.engine.status).toMatchObject({ state: 'idle', lastError: null, nextRetryAt: null });
  });

  it('starts over when a different account signs in', async () => {
    const a = device('a');
    const c1 = makeCard(a, 1, at(0));
    review(a, c1, 'good', at(1));
    a.repos.settings.set('theme', 'dark', at(1));
    a.repos.learnerSentences.add({
      it: 'Sono andata.',
      original: 'Ho andato.',
      errorTags: [],
      grammarIds: [],
      source: 'conversation',
    });
    expectOk(await a.engine.sync());

    a.user = 'user-2';
    const result = expectOk(await a.engine.sync());
    expect(result.pushed.review_log).toBe(1);
    expect(result.pushed.setting).toBe(1);
    expect(server.rows('user-2', 'review_log')).toHaveLength(1);
    expect(result.pushed.learner_sentence).toBe(1);
    expect(a.transport.pullCalls.at(-1)?.after).toBe(0);
  });

  it('reports status to subscribers', async () => {
    const a = device('a');
    const states: string[] = [];
    a.engine.subscribe((s) => states.push(s.state));
    makeCard(a, 1, at(0));
    a.repos.settings.set('theme', 'dark', at(1));
    expectOk(await a.engine.sync());
    expect(states).toEqual(['syncing', 'idle']);
    expect(a.engine.status.lastSuccessAt).toEqual(at(10_000));
    expect(a.engine.status.pending).toBe(0);
  });
});

describe('parseCardId', () => {
  it('decodes ids made by cardIdFor and nothing else', () => {
    expect(parseCardId(cardIdFor('dictation', 42, 'spoken'))).toEqual({
      kind: 'dictation',
      targetId: 42,
      promptMode: 'spoken',
    });
    expect(parseCardId(cardIdFor('sentence_production', -77, 'typed'))).toEqual({
      kind: 'sentence_production',
      targetId: -77,
      promptMode: 'typed',
    });
    expect(parseCardId('dictation:042:spoken')).toBeNull();
    expect(parseCardId('dictation:-0:spoken')).toBeNull();
    expect(parseCardId('unknown:1:typed')).toBeNull();
    expect(parseCardId('dictation:1:telepathic')).toBeNull();
    expect(parseCardId('card-1')).toBeNull();
  });
});
