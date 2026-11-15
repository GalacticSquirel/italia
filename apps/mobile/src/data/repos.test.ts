import { ZodError } from 'zod';

import {
  createTestDatabase,
  sequentialIds,
  type TestDatabase,
} from '@/db/testing/createTestDatabase';

import { learnerSentenceId } from './LearnerSentenceRepo';
import { createRepositories, type Repositories } from './repositories';
import { importSeedContent } from './seed/importSeed';
import { defaultSettings, type Settings } from './SettingsRepo';
import { EMPTY_STREAK } from './StreakRepo';
import { StudySessionNotActiveError } from './StudySessionRepo';
import { at, makeSeed } from './testing/fixtures';
import { chunk } from './util';

let t: TestDatabase;
let repos: Repositories;

beforeEach(() => {
  t = createTestDatabase();
  repos = createRepositories(t.db, { newId: sequentialIds() });
});

afterEach(() => {
  t.close();
});

describe('content repos', () => {
  it('looks up lemmas and sentences by id lists of any size', async () => {
    await importSeedContent(t.db, makeSeed(1, 2000), {
      yieldBetweenBatches: () => Promise.resolve(),
    });
    const ids = Array.from({ length: 1500 }, (_, i) => 1500 - i);
    const lemmas = repos.lemmas.getByIds([...ids, 1, 99999]);
    expect(lemmas).toHaveLength(1500);
    expect(lemmas[0]?.freqRank).toBe(1);
    expect(repos.sentences.getByIds([3, 1, 2]).map((s) => s.id)).toEqual([1, 2, 3]);
    expect(repos.lemmas.findByLemma('parola7').map((l) => l.id)).toEqual([7]);
    expect(repos.lemmas.listByFrequency({ offset: 10, limit: 2 }).map((l) => l.id)).toEqual([
      11, 12,
    ]);
    expect(repos.grammar.getById(2)?.prerequisiteIds).toEqual([1]);
    expect(repos.lemmas.getById(99999)).toBeNull();
  });
});

describe('LemmaRepo.search', () => {
  it('matches headword prefixes and glosses, most frequent first', async () => {
    await importSeedContent(t.db, makeSeed(1, 12), {
      yieldBetweenBatches: () => Promise.resolve(),
    });
    expect(repos.lemmas.search('parola1', { limit: 10 }).map((l) => l.id)).toEqual([1, 10, 11, 12]);
    expect(repos.lemmas.search('WORD 7', { limit: 10 }).map((l) => l.id)).toEqual([7]);
    expect(repos.lemmas.search('  ', { limit: 10 })).toEqual([]);
    expect(repos.lemmas.search('%', { limit: 10 })).toEqual([]);
    expect(repos.lemmas.search('parola', { offset: 10, limit: 5 }).map((l) => l.id)).toEqual([
      11, 12,
    ]);
  });
});

describe('SettingsRepo', () => {
  it('returns validated defaults', () => {
    const defaults: Settings = defaultSettings();
    expect(defaults).toMatchObject({
      dailyNewLimit: 20,
      minutesBudget: 60,
      desiredRetention: 0.9,
      voiceId: null,
      speechRate: 1,
    });
    expect(repos.settings.getAll()).toEqual(defaults);
  });

  it('stores, validates and resets values', () => {
    repos.settings.set('desiredRetention', 0.85, at(1));
    repos.settings.set('voiceId', 'it-female-1');
    expect(repos.settings.get('desiredRetention')).toBe(0.85);
    expect(repos.settings.getAll().voiceId).toBe('it-female-1');
    expect(() => {
      repos.settings.set('dailyNewLimit', -1);
    }).toThrow(ZodError);
    repos.settings.reset('desiredRetention');
    expect(repos.settings.get('desiredRetention')).toBe(0.9);
  });

  it('reads an invalid stored value as the default', () => {
    t.sqlite
      .prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
      .run('minutesBudget', JSON.stringify('lots'), 0);
    expect(repos.settings.get('minutesBudget')).toBe(60);
  });
});

describe('StreakRepo', () => {
  it('stores the day in progress and a pending repair', () => {
    const s = {
      currentDays: 0,
      longestDays: 12,
      lastStudyDate: '2026-11-14',
      freezesAvailable: 0,
      day: { date: '2026-11-14', activeMinutes: 12.5, completedSessions: 1 },
      repair: { missedDate: '2026-11-13', lostDays: 12, freezesNeeded: 0 },
    };
    repos.streak.save(s, at(1));
    expect(repos.streak.get()).toEqual(s);
    repos.streak.save({ ...s, repair: null }, at(2));
    expect(repos.streak.get().repair).toBeNull();
    expect(() => {
      repos.streak.save({ ...s, day: { ...s.day, activeMinutes: -1 } });
    }).toThrow(RangeError);
    expect(() => {
      repos.streak.save({ ...s, repair: { ...s.repair, missedDate: 'yesterday' } });
    }).toThrow(RangeError);
  });

  it('starts empty, saves and overwrites the single row', () => {
    expect(repos.streak.get()).toEqual(EMPTY_STREAK);
    expect(repos.streak.getUpdatedAt()).toBeNull();
    const s = {
      currentDays: 2,
      longestDays: 9,
      lastStudyDate: '2026-11-14',
      freezesAvailable: 1,
      day: null,
      repair: null,
    };
    repos.streak.save(s, at(1));
    repos.streak.save({ ...s, currentDays: 3 }, at(2));
    expect(repos.streak.get()).toEqual({ ...s, currentDays: 3 });
    expect(repos.streak.getUpdatedAt()).toEqual(at(2));
    expect(() => {
      repos.streak.save({ ...s, lastStudyDate: '14/11/2026' });
    }).toThrow(RangeError);
    expect(() => {
      repos.streak.save({ ...s, currentDays: -1 });
    }).toThrow(RangeError);
  });
});

describe('StudySessionRepo', () => {
  it('tracks active minutes and activities until the session ends', () => {
    const s = repos.studySessions.start(at(0));
    expect(repos.studySessions.getActive()?.id).toBe(s.id);
    repos.studySessions.heartbeat(s.id, 1.5);
    repos.studySessions.heartbeat(s.id, 2);
    repos.studySessions.addActivity(s.id, 'reviews');
    repos.studySessions.addActivity(s.id, 'speaking');
    const ended = repos.studySessions.end(s.id, at(10), 0.5);
    expect(ended).toMatchObject({
      endedAt: at(10),
      minutesActive: 4,
      activities: ['reviews', 'speaking'],
    });
    expect(repos.studySessions.getActive()).toBeNull();
    expect(() => {
      repos.studySessions.heartbeat(s.id, 1);
    }).toThrow(StudySessionNotActiveError);
    expect(() => {
      repos.studySessions.heartbeat('missing', 1);
    }).toThrow(StudySessionNotActiveError);
    const other = repos.studySessions.start(at(60));
    expect(() => {
      repos.studySessions.heartbeat(other.id, -1);
    }).toThrow(RangeError);
    repos.studySessions.end(other.id, at(70), 6);
    expect(repos.studySessions.totalActiveMinutes()).toBe(10);
    expect(repos.studySessions.totalActiveMinutes({ from: at(30), to: at(90) })).toBe(6);
    expect(repos.studySessions.listBetween(at(0), at(90)).map((r) => r.id)).toEqual([
      other.id,
      s.id,
    ]);
  });
});

describe('StoryRepo', () => {
  it('saves, replaces and lists stories', () => {
    const base = {
      level: 'A1',
      title: 'Al bar',
      bodyJson: { tokens: [] },
      source: 'bundled',
      seriesId: 'bar',
    } as const;
    repos.stories.save({ ...base, id: 's2', seriesIndex: 2, createdAt: at(1) });
    repos.stories.save({ ...base, id: 's1', seriesIndex: 1, createdAt: at(2) });
    repos.stories.save({ ...base, id: 's1', seriesIndex: 1, title: 'Al bar (1)' });
    expect(repos.stories.listSeries('bar').map((s) => s.id)).toEqual(['s1', 's2']);
    expect(repos.stories.getById('s1')?.title).toBe('Al bar (1)');
    expect(repos.stories.getById('s1')?.createdAt).toEqual(at(2));
    expect(repos.stories.listByLevel('A1')).toHaveLength(2);
    expect(repos.stories.listByLevel('B2')).toEqual([]);
  });
});

describe('ErrorRecordRepo', () => {
  it('records errors and counts them by category', () => {
    repos.errors.add({ category: 'a', example: '1', source: 'review', createdAt: at(1) });
    repos.errors.add({ category: 'b', example: '2', source: 'conversation', createdAt: at(2) });
    repos.errors.add({ category: 'b', example: '3', source: 'review', createdAt: at(3) });
    expect(repos.errors.listRecent(2).map((e) => e.example)).toEqual(['3', '2']);
    expect(repos.errors.listByCategory('b', 10)).toHaveLength(2);
    expect(repos.errors.countByCategory()).toEqual([
      { category: 'b', count: 2 },
      { category: 'a', count: 1 },
    ]);
  });
});

describe('LearnerSentenceRepo', () => {
  it('stores corrected sentences under stable negative ids', () => {
    const input = {
      it: '  Ieri sono  andata a Napoli. ',
      original: 'Ieri ho andato a Napoli.',
      errorTags: ['auxiliary-choice'],
      grammarIds: [23],
      source: 'conversation' as const,
      createdAt: at(1),
    };
    const row = repos.learnerSentences.add(input);
    expect(row.id).toBeLessThan(0);
    expect(row.id).toBe(learnerSentenceId('Ieri sono andata a Napoli.'));
    expect(row.it).toBe('Ieri sono andata a Napoli.');
    expect(repos.learnerSentences.add({ ...input, createdAt: at(5) })).toEqual(row);
    const other = repos.learnerSentences.add({ ...input, it: 'Vado a Roma.', createdAt: at(2) });
    expect(repos.learnerSentences.listAll().map((r) => r.id)).toEqual([other.id, row.id]);
    expect(repos.learnerSentences.getByIds([row.id, 99])).toEqual([row]);
    expect(repos.learnerSentences.getById(-1)).toBeNull();
  });
});

describe('MetaRepo', () => {
  it('creates the device id once', () => {
    const id = repos.meta.getOrCreateDeviceId();
    expect(repos.meta.getOrCreateDeviceId()).toBe(id);
  });
});

describe('chunk', () => {
  it('splits arrays and rejects bad sizes', () => {
    expect(chunk([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
    expect(chunk([], 2)).toEqual([]);
    expect(() => chunk([1], 0)).toThrow(RangeError);
  });
});
