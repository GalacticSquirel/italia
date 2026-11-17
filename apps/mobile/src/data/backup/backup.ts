import { asc, eq } from 'drizzle-orm';

import {
  card,
  errorRecord,
  lemmaExposure,
  reviewLog,
  settings,
  storyProgress,
  streakState,
  studySession,
} from '@/db/schema';
import type { AppDatabase } from '@/db/types';

import type { CardRow, NewCardRow, NewReviewLogRow } from '../rows';
import { getImportedSeedVersion } from '../seed/importSeed';
import { isSettingKey, SETTINGS_SCHEMA } from '../SettingsRepo';
import { streakFromColumns, streakToColumns } from '../StreakRepo';
import { chunk, MAX_PARAMS_PER_STATEMENT } from '../util';
import {
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  BackupFileSchema,
  type BackupFile,
} from './backupSchema';

/** How {@link importBackup} combines the backup with the data on the device. */
export type ImportStrategy = 'merge' | 'replace';

/** Options for {@link importBackup}. */
export interface ImportBackupOptions {
  /** Defaults to `merge`. */
  strategy?: ImportStrategy;
}

/** Per-table counts of what {@link importBackup} did. */
export interface ImportBackupResult {
  cards: { inserted: number; updated: number; remapped: number };
  reviewLogs: { inserted: number; duplicates: number; orphaned: number };
  settings: { applied: number; skipped: number };
  streakUpdated: boolean;
  studySessions: { inserted: number; updated: number };
  errorRecords: { inserted: number; duplicates: number };
  storyProgress: { inserted: number; updated: number };
  lemmaExposure: { inserted: number; updated: number };
}

/** Thrown when a backup was written by a newer app version. */
export class UnsupportedBackupVersionError extends Error {
  constructor(readonly schemaVersion: number) {
    super(
      `Backup schema version ${String(schemaVersion)} is newer than supported (${String(BACKUP_SCHEMA_VERSION)})`,
    );
    this.name = 'UnsupportedBackupVersionError';
  }
}

const time = (d: Date): number => d.getTime();
const timeOrNull = (d: Date | null): number | null => (d === null ? null : d.getTime());
const date = (ms: number): Date => new Date(ms);
const dateOrNull = (ms: number | null): Date | null => (ms === null ? null : new Date(ms));

function insertChunked<T>(rows: readonly T[], columns: number, insert: (part: T[]) => void): void {
  for (const part of chunk(rows, Math.floor(MAX_PARAMS_PER_STATEMENT / columns))) {
    insert(part);
  }
}

/**
 * Export all learner data as a JSON-safe object: cards, review logs, settings,
 * streak, study sessions, error records, reading progress and words met in
 * stories. Content tables are not included
 * (they come from the seed), nor is device-local metadata such as the device
 * id. Times are epoch milliseconds. Serialise with `JSON.stringify`.
 */
export function exportBackup(db: AppDatabase, now: Date = new Date()): BackupFile {
  const streak = db.select().from(streakState).get();
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    seedVersion: getImportedSeedVersion(db),
    cards: db
      .select()
      .from(card)
      .orderBy(asc(card.id))
      .all()
      .map((c) => ({
        ...c,
        due: time(c.due),
        lastReview: timeOrNull(c.lastReview),
        createdAt: time(c.createdAt),
      })),
    reviewLogs: db
      .select()
      .from(reviewLog)
      .orderBy(asc(reviewLog.reviewedAt), asc(reviewLog.id))
      .all()
      .map((l) => ({ ...l, reviewedAt: time(l.reviewedAt), syncedAt: timeOrNull(l.syncedAt) })),
    settings: db
      .select()
      .from(settings)
      .orderBy(asc(settings.key))
      .all()
      .map((s) => ({ ...s, updatedAt: time(s.updatedAt) })),
    streakState: streak
      ? { ...streakFromColumns(streak), updatedAt: time(streak.updatedAt) }
      : null,
    studySessions: db
      .select()
      .from(studySession)
      .orderBy(asc(studySession.startedAt), asc(studySession.id))
      .all()
      .map((s) => ({ ...s, startedAt: time(s.startedAt), endedAt: timeOrNull(s.endedAt) })),
    errorRecords: db
      .select()
      .from(errorRecord)
      .orderBy(asc(errorRecord.createdAt), asc(errorRecord.id))
      .all()
      .map((e) => ({ ...e, createdAt: time(e.createdAt) })),
    storyProgress: db
      .select()
      .from(storyProgress)
      .orderBy(asc(storyProgress.storyId))
      .all()
      .map((p) => ({
        ...p,
        startedAt: time(p.startedAt),
        completedAt: timeOrNull(p.completedAt),
        updatedAt: time(p.updatedAt),
      })),
    lemmaExposure: db
      .select()
      .from(lemmaExposure)
      .orderBy(asc(lemmaExposure.lemmaId))
      .all()
      .map((e) => ({ ...e, firstSeenAt: time(e.firstSeenAt), lastSeenAt: time(e.lastSeenAt) })),
  };
}

/** Parse and validate a backup from a JSON string or an already-parsed object. */
export function parseBackup(input: unknown): BackupFile {
  const raw: unknown = typeof input === 'string' ? JSON.parse(input) : input;
  const file = BackupFileSchema.parse(raw);
  if (file.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new UnsupportedBackupVersionError(file.schemaVersion);
  }
  return file;
}

const targetKey = (c: { kind: string; targetId: number; promptMode: string }): string =>
  `${c.kind}\u0000${String(c.targetId)}\u0000${c.promptMode}`;

function toCardRow(c: BackupFile['cards'][number]): NewCardRow {
  return {
    ...c,
    due: date(c.due),
    lastReview: dateOrNull(c.lastReview),
    createdAt: date(c.createdAt),
  };
}

/**
 * Import a backup in one transaction (all or nothing).
 *
 * **`replace`** deletes all learner data on the device and restores the backup
 * exactly (including `syncedAt` markers). Content and device metadata are kept.
 *
 * **`merge`** (default) combines backup and device data; conflict rules:
 * - **review_log**: union by `id`. A log already on the device is left
 *   untouched (logs are immutable). Newly inserted logs get `syncedAt = null`
 *   so sync pushes them (the server merges by union too, so this is
 *   idempotent). Logs whose card exists neither on the device nor in the
 *   backup are skipped and counted as orphaned.
 * - **card**: matched by `id`, or failing that by `(kind, targetId,
 *   promptMode)` (cards made before ids were deterministic); a backup card
 *   matched by target is folded into the device card and its logs and error
 *   records are re-pointed at the device card's id. When both sides have the
 *   card, the side with the later `lastReview` wins all FSRS fields and
 *   `suspended` (ties keep the device). A card's FSRS state is a cache of its
 *   logs, so after a merge it can be rebuilt by replaying the merged logs.
 *   TODO(core): replay merged cards with the log replay from `@italia/core`
 *   once it lands, instead of picking the most recently reviewed side.
 * - **settings**: last writer wins per key by `updatedAt` (ties keep the
 *   device). Unknown keys and values that fail validation are skipped.
 * - **streak_state**: the later `updatedAt` wins; `longestDays` is the
 *   maximum of both sides.
 * - **study_session**: union by `id`; when both have a session, the one with
 *   more active minutes wins (it is the more complete record).
 * - **error_record**: union by `id`; a `cardId` that matches no card becomes null.
 * - **story_progress**: per story, the earliest start and first completion,
 *   the larger read and word counts, and the position and comprehension
 *   result of the side updated last.
 * - **lemma_exposure**: per lemma, the larger count (counts from two devices
 *   cannot be told apart, so they are not added), the earliest first and
 *   latest last sighting.
 *
 * @param input - a backup object or its JSON string
 * @throws ZodError when the backup is malformed
 * @throws UnsupportedBackupVersionError when the backup is from a newer app version
 */
export function importBackup(
  db: AppDatabase,
  input: unknown,
  options: ImportBackupOptions = {},
): ImportBackupResult {
  const file = parseBackup(input);
  const strategy = options.strategy ?? 'merge';
  const result: ImportBackupResult = {
    cards: { inserted: 0, updated: 0, remapped: 0 },
    reviewLogs: { inserted: 0, duplicates: 0, orphaned: 0 },
    settings: { applied: 0, skipped: 0 },
    streakUpdated: false,
    studySessions: { inserted: 0, updated: 0 },
    errorRecords: { inserted: 0, duplicates: 0 },
    storyProgress: { inserted: 0, updated: 0 },
    lemmaExposure: { inserted: 0, updated: 0 },
  };

  db.transaction((tx) => {
    if (strategy === 'replace') {
      tx.delete(errorRecord).run();
      tx.delete(reviewLog).run();
      tx.delete(card).run();
      tx.delete(settings).run();
      tx.delete(streakState).run();
      tx.delete(studySession).run();
      tx.delete(storyProgress).run();
      tx.delete(lemmaExposure).run();
    }

    // Cards ------------------------------------------------------------------
    const local = new Map<string, CardRow>();
    const localByTarget = new Map<string, string>();
    for (const c of tx.select().from(card).all()) {
      local.set(c.id, c);
      localByTarget.set(targetKey(c), c.id);
    }
    const cardIdMap = new Map<string, string>();
    const toInsert: NewCardRow[] = [];
    for (const incoming of file.cards) {
      const matchId = local.has(incoming.id) ? incoming.id : localByTarget.get(targetKey(incoming));
      if (matchId === undefined) {
        cardIdMap.set(incoming.id, incoming.id);
        localByTarget.set(targetKey(incoming), incoming.id);
        toInsert.push(toCardRow(incoming));
        continue;
      }
      cardIdMap.set(incoming.id, matchId);
      if (matchId !== incoming.id) result.cards.remapped += 1;
      const existing = local.get(matchId);
      if (existing === undefined) continue; // matched a card inserted earlier in this import
      const localReview = existing.lastReview?.getTime() ?? -Infinity;
      const incomingReview = incoming.lastReview ?? -Infinity;
      if (incomingReview > localReview) {
        const {
          id: _id,
          kind: _k,
          targetId: _t,
          promptMode: _p,
          createdAt: _c,
          ...fsrs
        } = toCardRow(incoming);
        tx.update(card).set(fsrs).where(eq(card.id, matchId)).run();
        result.cards.updated += 1;
      }
    }
    insertChunked(toInsert, 15, (part) => {
      tx.insert(card).values(part).run();
    });
    result.cards.inserted = toInsert.length;
    const resolveCard = (id: string): string | null =>
      cardIdMap.get(id) ?? (local.has(id) ? id : null);

    // Review logs ------------------------------------------------------------
    const logs: NewReviewLogRow[] = [];
    for (const l of file.reviewLogs) {
      const cardId = resolveCard(l.cardId);
      if (cardId === null) {
        result.reviewLogs.orphaned += 1;
        continue;
      }
      logs.push({
        ...l,
        cardId,
        reviewedAt: date(l.reviewedAt),
        syncedAt: strategy === 'replace' ? dateOrNull(l.syncedAt) : null,
      });
    }
    insertChunked(logs, 8, (part) => {
      const inserted = tx
        .insert(reviewLog)
        .values(part)
        .onConflictDoNothing({ target: reviewLog.id })
        .returning({ id: reviewLog.id })
        .all().length;
      result.reviewLogs.inserted += inserted;
      result.reviewLogs.duplicates += part.length - inserted;
    });

    // Settings ---------------------------------------------------------------
    for (const s of file.settings) {
      if (!isSettingKey(s.key) || !SETTINGS_SCHEMA[s.key].safeParse(s.value).success) {
        result.settings.skipped += 1;
        continue;
      }
      const existing = tx.select().from(settings).where(eq(settings.key, s.key)).get();
      if (existing && existing.updatedAt.getTime() >= s.updatedAt) {
        result.settings.skipped += 1;
        continue;
      }
      // An applied value is pushed by the next sync like a local change.
      const row = {
        key: s.key,
        value: s.value,
        updatedAt: date(s.updatedAt),
        deviceId: null,
        syncedAt: null,
      };
      tx.insert(settings)
        .values(row)
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: row.value, updatedAt: row.updatedAt, deviceId: null, syncedAt: null },
        })
        .run();
      result.settings.applied += 1;
    }

    // Streak -----------------------------------------------------------------
    if (file.streakState) {
      const incoming = file.streakState;
      const existing = tx.select().from(streakState).get();
      if (!existing || existing.updatedAt.getTime() < incoming.updatedAt) {
        const values = {
          ...streakToColumns({
            ...incoming,
            longestDays: Math.max(incoming.longestDays, existing?.longestDays ?? 0),
          }),
          updatedAt: date(incoming.updatedAt),
        };
        tx.insert(streakState)
          .values({ id: 1, ...values })
          .onConflictDoUpdate({ target: streakState.id, set: values })
          .run();
        result.streakUpdated = true;
      } else if (incoming.longestDays > existing.longestDays) {
        tx.update(streakState)
          .set({ longestDays: incoming.longestDays })
          .where(eq(streakState.id, existing.id))
          .run();
        result.streakUpdated = true;
      }
    }

    // Study sessions ---------------------------------------------------------
    for (const s of file.studySessions) {
      const row = { ...s, startedAt: date(s.startedAt), endedAt: dateOrNull(s.endedAt) };
      const existing = tx
        .select({ minutesActive: studySession.minutesActive })
        .from(studySession)
        .where(eq(studySession.id, s.id))
        .get();
      if (!existing) {
        tx.insert(studySession).values(row).run();
        result.studySessions.inserted += 1;
      } else if (s.minutesActive > existing.minutesActive) {
        const { id: _id, ...rest } = row;
        tx.update(studySession).set(rest).where(eq(studySession.id, s.id)).run();
        result.studySessions.updated += 1;
      }
    }

    // Error records ----------------------------------------------------------
    const errors = file.errorRecords.map((e) => ({
      ...e,
      cardId: e.cardId === null ? null : resolveCard(e.cardId),
      createdAt: date(e.createdAt),
    }));
    insertChunked(errors, 6, (part) => {
      const inserted = tx
        .insert(errorRecord)
        .values(part)
        .onConflictDoNothing({ target: errorRecord.id })
        .returning({ id: errorRecord.id })
        .all().length;
      result.errorRecords.inserted += inserted;
      result.errorRecords.duplicates += part.length - inserted;
    });

    // Story progress ---------------------------------------------------------
    for (const p of file.storyProgress) {
      const incoming = {
        ...p,
        startedAt: date(p.startedAt),
        completedAt: dateOrNull(p.completedAt),
        updatedAt: date(p.updatedAt),
      };
      const existing = tx
        .select()
        .from(storyProgress)
        .where(eq(storyProgress.storyId, p.storyId))
        .get();
      if (!existing) {
        tx.insert(storyProgress).values(incoming).run();
        result.storyProgress.inserted += 1;
        continue;
      }
      const later = p.updatedAt > existing.updatedAt.getTime() ? incoming : existing;
      const completed = [existing.completedAt, incoming.completedAt]
        .filter((d): d is Date => d !== null)
        .sort((a, b) => a.getTime() - b.getTime())[0];
      tx.update(storyProgress)
        .set({
          startedAt: new Date(Math.min(p.startedAt, existing.startedAt.getTime())),
          completedAt: completed ?? null,
          timesRead: Math.max(p.timesRead, existing.timesRead),
          wordsRead: Math.max(p.wordsRead, existing.wordsRead),
          lastSentence: later.lastSentence,
          comprehensionCorrect: later.comprehensionCorrect,
          comprehensionTotal: later.comprehensionTotal,
          updatedAt: later.updatedAt,
        })
        .where(eq(storyProgress.storyId, p.storyId))
        .run();
      result.storyProgress.updated += 1;
    }

    // Lemma exposure ---------------------------------------------------------
    for (const e of file.lemmaExposure) {
      const existing = tx
        .select()
        .from(lemmaExposure)
        .where(eq(lemmaExposure.lemmaId, e.lemmaId))
        .get();
      if (!existing) {
        tx.insert(lemmaExposure)
          .values({ ...e, firstSeenAt: date(e.firstSeenAt), lastSeenAt: date(e.lastSeenAt) })
          .run();
        result.lemmaExposure.inserted += 1;
        continue;
      }
      tx.update(lemmaExposure)
        .set({
          count: Math.max(e.count, existing.count),
          firstSeenAt: new Date(Math.min(e.firstSeenAt, existing.firstSeenAt.getTime())),
          lastSeenAt: new Date(Math.max(e.lastSeenAt, existing.lastSeenAt.getTime())),
        })
        .where(eq(lemmaExposure.lemmaId, e.lemmaId))
        .run();
      result.lemmaExposure.updated += 1;
    }
  });

  return result;
}
