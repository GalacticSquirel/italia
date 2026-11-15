import { card as cardTable } from '@/db/schema';
import {
  createTestDatabase,
  sequentialIds,
  type TestDatabase,
} from '@/db/testing/createTestDatabase';

import { createRepositories, type Repositories } from '../repositories';
import { exportBackup, importBackup, parseBackup, UnsupportedBackupVersionError } from './backup';
import { BACKUP_SCHEMA_VERSION, type BackupFile } from './backupSchema';
import { importSeedContent } from '../seed/importSeed';
import { at, makeSeed, schedule } from '../testing/fixtures';

interface Device {
  t: TestDatabase;
  repos: Repositories;
}

const devices: Device[] = [];

function device(prefix: string): Device {
  const t = createTestDatabase();
  const d = { t, repos: createRepositories(t.db, { newId: sequentialIds(prefix) }) };
  devices.push(d);
  return d;
}

afterEach(() => {
  for (const d of devices.splice(0)) d.t.close();
});

/** Populate every learner table on a device. */
function populate({ repos }: Device, deviceId: string, offsetMin = 0): { cardId: string } {
  const c = repos.cards.create({
    kind: 'cloze_production',
    targetId: 1,
    promptMode: 'typed',
    schedule: schedule(),
    createdAt: at(offsetMin),
  });
  repos.recordReview({
    cardId: c.id,
    rating: 'good',
    answer: 'ciao',
    latencyMs: 1000,
    reviewedAt: at(offsetMin + 1),
    deviceId,
    next: schedule({ state: 'learning', reps: 1, lastReview: at(offsetMin + 1) }),
  });
  repos.settings.set('dailyNewLimit', 15, at(offsetMin + 2));
  repos.streak.save(
    {
      currentDays: 3,
      longestDays: 3,
      lastStudyDate: '2026-11-01',
      freezesAvailable: 1,
      day: { date: '2026-11-01', activeMinutes: 14, completedSessions: 1 },
      repair: { missedDate: '2026-10-28', lostDays: 2, freezesNeeded: 0 },
    },
    at(offsetMin + 3),
  );
  const s = repos.studySessions.start(at(offsetMin));
  repos.studySessions.addActivity(s.id, 'reviews');
  repos.studySessions.end(s.id, at(offsetMin + 20), 12.5);
  repos.errors.add({
    category: 'agreement.gender',
    example: 'la problema',
    source: 'review',
    cardId: c.id,
    createdAt: at(offsetMin + 4),
  });
  repos.learnerSentences.add({
    it: 'Ieri sono andata a Napoli.',
    original: 'Ieri ho andato a Napoli.',
    errorTags: ['auxiliary-choice'],
    grammarIds: [23],
    source: 'conversation',
    createdAt: at(offsetMin + 5),
  });
  return { cardId: c.id };
}

describe('backup', () => {
  it('reads an older backup without the streak day and repair', () => {
    const a = device('a');
    populate(a, 'dev-a');
    const file = exportBackup(a.t.db);
    const raw = JSON.parse(JSON.stringify(file)) as { streakState: Record<string, unknown> };
    delete raw.streakState.day;
    delete raw.streakState.repair;
    const b = device('b');
    importBackup(b.t.db, parseBackup(raw));
    expect(b.repos.streak.get()).toMatchObject({ currentDays: 3, day: null, repair: null });
  });

  it('round-trips every learner table through JSON', async () => {
    const a = device('a');
    await importSeedContent(a.t.db, makeSeed(3), { yieldBetweenBatches: () => Promise.resolve() });
    populate(a, 'device-a');
    a.repos.reviewLogs.markSynced(
      a.repos.reviewLogs.listUnsynced(10).map((l) => l.id),
      at(30),
    );
    const file = exportBackup(a.t.db, at(60));
    expect(file).toMatchObject({
      format: 'italia-backup',
      schemaVersion: BACKUP_SCHEMA_VERSION,
      seedVersion: 3,
      exportedAt: at(60).toISOString(),
    });
    expect(file.cards).toHaveLength(1);
    expect(file.reviewLogs).toHaveLength(1);
    expect(file.studySessions[0]?.activities).toEqual(['reviews']);
    expect(file.learnerSentences?.map((l) => l.it)).toEqual(['Ieri sono andata a Napoli.']);

    const b = device('b');
    importBackup(b.t.db, JSON.stringify(file), { strategy: 'replace' });
    const roundTrip = exportBackup(b.t.db, at(60));
    expect({ ...roundTrip, seedVersion: 3 }).toEqual(file);
  });

  it('merges review logs by union and dedupes by id', () => {
    const a = device('a');
    const { cardId } = populate(a, 'device-a');
    const fileA = exportBackup(a.t.db);

    const b = device('b');
    importBackup(b.t.db, fileA);
    // Device B reviews the same card again later.
    b.repos.recordReview({
      cardId,
      rating: 'hard',
      answer: 'ciau',
      latencyMs: 3000,
      reviewedAt: at(100),
      deviceId: 'device-b',
      next: schedule({ state: 'review', reps: 2, lastReview: at(100) }),
    });
    const fileB = exportBackup(b.t.db);

    // Merge B back into A: A gains B's review, keeps its own once.
    const result = importBackup(a.t.db, fileB);
    expect(result.reviewLogs).toEqual({ inserted: 1, duplicates: 1, orphaned: 0 });
    expect(a.repos.reviewLogs.listForCard(cardId).map((l) => l.deviceId)).toEqual([
      'device-a',
      'device-b',
    ]);
    // The newly merged row is unsynced so sync pushes it; A's own row keeps its marker state.
    expect(a.repos.reviewLogs.listUnsynced(10)).toHaveLength(2);
    // B reviewed later, so its FSRS state wins.
    expect(result.cards.updated).toBe(1);
    expect(a.repos.cards.getById(cardId)).toMatchObject({ reps: 2, state: 'review' });

    // Importing the same file again changes nothing.
    const again = importBackup(a.t.db, fileB);
    expect(again.reviewLogs).toEqual({ inserted: 0, duplicates: 2, orphaned: 0 });
    expect(again.cards).toEqual({ inserted: 0, updated: 0, remapped: 0 });
    expect(again.studySessions).toEqual({ inserted: 0, updated: 0 });
    expect(again.errorRecords).toEqual({ inserted: 0, duplicates: 1 });
  });

  it('keeps the device card state when the device reviewed it more recently', () => {
    const a = device('a');
    const { cardId } = populate(a, 'device-a');
    const old = exportBackup(a.t.db);
    a.repos.recordReview({
      cardId,
      rating: 'easy',
      answer: null,
      latencyMs: 500,
      reviewedAt: at(500),
      deviceId: 'device-a',
      next: schedule({ state: 'review', reps: 7, lastReview: at(500) }),
    });
    const result = importBackup(a.t.db, old);
    expect(result.cards.updated).toBe(0);
    expect(a.repos.cards.getById(cardId)?.reps).toBe(7);
  });

  it('applies settings last-writer-wins per key and keeps the longest streak', () => {
    const a = device('a');
    a.repos.settings.set('dailyNewLimit', 10, at(10));
    a.repos.settings.set('minutesBudget', 30, at(10));
    a.repos.streak.save(
      {
        currentDays: 1,
        longestDays: 40,
        lastStudyDate: '2026-11-02',
        freezesAvailable: 0,
        day: null,
        repair: null,
      },
      at(10),
    );

    const b = device('b');
    b.repos.settings.set('dailyNewLimit', 25, at(20)); // newer: wins
    b.repos.settings.set('minutesBudget', 90, at(5)); // older: loses
    b.repos.streak.save(
      {
        currentDays: 5,
        longestDays: 5,
        lastStudyDate: '2026-11-03',
        freezesAvailable: 2,
        day: null,
        repair: null,
      },
      at(20),
    );
    const file: BackupFile = exportBackup(b.t.db);
    file.settings.push(
      { key: 'notASetting', value: 1, updatedAt: at(99).getTime() },
      { key: 'speechRate', value: 99, updatedAt: at(99).getTime() },
    );

    const result = importBackup(a.t.db, file);
    expect(result.settings).toEqual({ applied: 1, skipped: 3 });
    expect(a.repos.settings.get('dailyNewLimit')).toBe(25);
    expect(a.repos.settings.get('minutesBudget')).toBe(30);
    expect(a.repos.settings.get('speechRate')).toBe(1);
    expect(a.repos.streak.get()).toEqual({
      currentDays: 5,
      longestDays: 40,
      lastStudyDate: '2026-11-03',
      freezesAvailable: 2,
      day: null,
      repair: null,
    });
  });

  it('folds a backup card into the device card with the same target and re-points its logs', () => {
    const a = device('a');
    const local = a.repos.cards.create({
      kind: 'dictation',
      targetId: 9,
      promptMode: 'typed',
      schedule: schedule(),
    });
    const b = device('b');
    // A legacy card on B with a random id for the same target.
    b.t.db
      .insert(cardTable)
      .values({
        id: 'legacy-uuid',
        kind: 'dictation',
        targetId: 9,
        promptMode: 'typed',
        ...schedule({ state: 'review', reps: 1, lastReview: at(5) }),
      })
      .run();
    b.repos.reviewLogs.append({
      cardId: 'legacy-uuid',
      rating: 'good',
      answer: null,
      latencyMs: 10,
      reviewedAt: at(5),
      deviceId: 'device-b',
    });
    const file = exportBackup(b.t.db);
    const [log] = file.reviewLogs;
    if (!log) throw new Error('fixture');
    file.reviewLogs.push({ ...log, id: 'orphan', cardId: 'no-such-card' });

    const result = importBackup(a.t.db, file);
    expect(result.cards).toEqual({ inserted: 0, updated: 1, remapped: 1 });
    expect(result.reviewLogs).toEqual({ inserted: 1, duplicates: 0, orphaned: 1 });
    expect(a.repos.reviewLogs.listForCard(local.id)).toHaveLength(1);
    expect(a.repos.cards.countsByState().total).toBe(1);
  });

  it('is all or nothing and rejects newer or malformed backups', () => {
    const a = device('a');
    populate(a, 'device-a');
    const file = exportBackup(a.t.db);
    const b = device('b');

    expect(() =>
      importBackup(b.t.db, { ...file, schemaVersion: BACKUP_SCHEMA_VERSION + 1 }),
    ).toThrow(UnsupportedBackupVersionError);
    expect(() => importBackup(b.t.db, { ...file, cards: [{ id: 'x' }] })).toThrow();
    expect(() => importBackup(b.t.db, '{not json')).toThrow();

    // Make the last step (error records) fail: nothing before it may be kept.
    b.t.sqlite.exec(
      "CREATE TRIGGER fail_errors BEFORE INSERT ON error_record BEGIN SELECT RAISE(ABORT, 'boom'); END",
    );
    expect(() => importBackup(b.t.db, file)).toThrow(/boom/);
    expect(b.repos.cards.countsByState().total).toBe(0);
    expect(b.repos.reviewLogs.count()).toBe(0);
    expect(b.repos.settings.get('dailyNewLimit')).toBe(20);
  });
});
