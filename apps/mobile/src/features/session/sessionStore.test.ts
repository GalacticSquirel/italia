import { createRepositories, importSeedContent, type Repositories } from '@/data';
import {
  createTestDatabase,
  sequentialIds,
  type TestDatabase,
} from '@/db/testing/createTestDatabase';
import { planToday } from '@/features/study/planning';
import { FIXTURE_SEED } from '@/testing/fixtureSeed';

import { decodeAnswer } from './answerLog';
import { createSessionStore, REVIEW_SESSION_ACTIVITY, type SessionStore } from './sessionStore';

let t: TestDatabase;
let repos: Repositories;
let clock: number;
const now = () => new Date(clock);
const tick = (ms: number) => {
  clock += ms;
};

beforeEach(async () => {
  t = createTestDatabase();
  repos = createRepositories(t.db, { newId: sequentialIds() });
  await importSeedContent(t.db, FIXTURE_SEED, { yieldBetweenBatches: () => Promise.resolve() });
  clock = new Date(2026, 10, 16, 9, 0, 0).getTime();
});

afterEach(() => {
  t.close();
});

/** Answer the current item correctly (or wrongly) and continue. */
function step(store: SessionStore, correct = true) {
  const s = store.getState();
  if (s.phase === 'grammar_intro') {
    s.dismissGrammarIntro();
    return;
  }
  const prompt = s.prompt;
  if (!prompt) throw new Error(`no prompt in phase ${s.phase}`);
  tick(20_000);
  if (prompt.kind === 'recognition') {
    s.acknowledgeRecognition();
    return;
  }
  store.getState().submitTyped(correct ? (prompt.accepted[0] ?? '') : 'zzz');
  store.getState().continue();
}

describe('session store', () => {
  it('runs a first session end to end and persists every review', () => {
    repos.settings.set('dailyNewLimit', 4);
    const store = createSessionStore({ repos, now });
    store.getState().start();
    const first = store.getState();
    expect(first.phase).toBe('prompt');
    expect(first.prompt?.kind).toBe('recognition');
    expect(first.plannedItems).toBeGreaterThanOrEqual(8);

    let guard = 0;
    while (store.getState().phase !== 'summary' && guard++ < 100) step(store);

    const { summary } = store.getState();
    expect(summary).not.toBeNull();
    expect(summary?.newWords).toBe(4);
    expect(summary?.accuracy).toBe(1);
    expect(summary?.minutes).toBeGreaterThan(0);
    // Every new cloze card is repeated once after a gap: 4 recognitions + 4 clozes x 2.
    expect(repos.reviewLogs.count()).toBe(summary?.answers);
    expect(summary?.answers).toBe(12);
    expect(summary?.streak.status).toBe('active');
    expect(summary?.streak.currentDays).toBe(1);
    expect(summary?.streakEvents).toContainEqual({ type: 'day_counted', date: '2026-11-16' });

    const sessions = repos.studySessions.listBetween(new Date(0), new Date(clock + 1));
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.endedAt).not.toBeNull();
    expect(sessions[0]?.activities).toEqual([REVIEW_SESSION_ACTIVITY]);
    expect(sessions[0]?.minutesActive).toBeCloseTo(summary?.minutes ?? 0, 5);

    // The day's new words are used up: the next plan has nothing new.
    expect(planToday(repos, now()).newWords).toBe(0);
  });

  it('brings a failed item back later in the session and records overrides', () => {
    repos.settings.set('dailyNewLimit', 3);
    const store = createSessionStore({ repos, now });
    store.getState().start();
    // Skip to the first typed prompt.
    while (store.getState().prompt?.kind === 'recognition') step(store);
    const failedId = store.getState().entry?.item.cardId;
    store.getState().submitTyped('sbagliato');
    expect(store.getState().feedback?.grade.correct).toBe(false);
    expect(store.getState().feedback?.rating).toBe('again');
    store.getState().overrideCorrect();
    expect(store.getState().feedback?.rating).toBe('good');
    store.getState().continue();

    const log = repos.reviewLogs.listForCard(failedId ?? '')[0];
    expect(log?.rating).toBe('good');
    expect(decodeAnswer(log?.answer ?? '')).toEqual({
      text: 'sbagliato',
      override: { from: 'again', to: 'good' },
    });

    // Fail the next typed item outright: it must come back.
    while (store.getState().prompt?.kind === 'recognition') step(store);
    const againId = store.getState().entry?.item.cardId;
    step(store, false);
    const seen: string[] = [];
    let guard = 0;
    while (store.getState().phase !== 'summary' && guard++ < 100) {
      const id = store.getState().entry?.item.cardId;
      if (id) seen.push(id);
      step(store);
    }
    expect(seen).toContain(againId);
    expect(store.getState().summary?.accuracy).toBeLessThan(1);
  });

  it('pauses study time while the app is in the background', () => {
    repos.settings.set('dailyNewLimit', 1);
    const store = createSessionStore({ repos, now });
    store.getState().start();
    tick(60_000);
    store.getState().pause();
    tick(30 * 60_000);
    store.getState().resume();
    tick(60_000);
    store.getState().quit();
    const [session] = repos.studySessions.listBetween(new Date(0), new Date(clock + 1));
    expect(session?.minutesActive).toBeCloseTo(2, 5);
    expect(session?.endedAt).not.toBeNull();
    expect(repos.streak.get().day?.activeMinutes).toBeCloseTo(2, 5);
  });

  it('reports each ended session once, so sync can push it', () => {
    repos.settings.set('dailyNewLimit', 1);
    const onSessionEnded = jest.fn();
    const store = createSessionStore({ repos, now, onSessionEnded });
    store.getState().start();
    tick(60_000);
    store.getState().quit();
    store.getState().quit();
    expect(onSessionEnded).toHaveBeenCalledTimes(1);
  });

  it('introduces a grammar point before its first item', () => {
    // Introduce every word so grammar practice becomes available.
    repos.settings.set('dailyNewLimit', 40);
    const first = createSessionStore({ repos, now });
    first.getState().start();
    let guard = 0;
    while (first.getState().phase !== 'summary' && guard++ < 300) step(first);

    tick(24 * 3_600_000);
    const second = createSessionStore({ repos, now });
    second.getState().start();
    const intros: string[] = [];
    guard = 0;
    while (second.getState().phase !== 'summary' && guard++ < 300) {
      const s = second.getState();
      if (s.phase === 'grammar_intro' && s.grammarIntro) intros.push(s.grammarIntro.title);
      step(second);
    }
    expect(intros).toEqual(['Essere (to be) in the present']);
  });

  it('shows an empty state when there is nothing to study', () => {
    repos.settings.set('dailyNewLimit', 0);
    const store = createSessionStore({ repos, now });
    store.getState().start();
    expect(store.getState().phase).toBe('empty');
    expect(repos.studySessions.getActive()).toBeNull();
  });
});
