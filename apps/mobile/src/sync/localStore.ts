/**
 * The local side of sync: reading rows that still need pushing, marking them
 * pushed, and merging pulled rows into the SQLite database.
 *
 * Merge rules (see docs/sync.md):
 * - review_log, study_session, error_record: append-only, union by id. A row
 *   the device already has is left untouched.
 * - card flags and settings: last-writer-wins by (updatedAt, deviceId); ties
 *   with identical values are no-ops, and a local null device id means this
 *   device.
 * - cards are never synced: a pulled review creates its card from the
 *   deterministic card id if needed, and every card that gained reviews has
 *   its FSRS state rebuilt by replaying all its logs.
 */
import { and, asc, eq, gt, inArray, isNotNull, isNull, sql } from 'drizzle-orm';

import {
  type CardFlagDto,
  type ErrorRecordDto,
  type JsonValue,
  type PullResponseFor,
  type ReviewLogDto,
  type SettingDto,
  type StudySessionDto,
  type SyncRowMap,
  type SyncTable,
} from '@italia/api-contract';
import {
  CARD_KINDS,
  PROMPT_MODES,
  rebuildCardState,
  type CardKind,
  type PromptMode,
  type Scheduler,
} from '@italia/core';

import { cardIdFor } from '@/data/ids';
import { isSettingKey, SETTINGS_SCHEMA } from '@/data/SettingsRepo';
import { chunk, MAX_IDS_PER_QUERY } from '@/data/util';
import { card, errorRecord, reviewLog, settings, studySession } from '@/db/schema';
import type { AppDatabase } from '@/db/types';

/** One table's rows still to push, and how to mark them once pushed. */
export interface UnsyncedBatch<K extends SyncTable> {
  rows: SyncRowMap[K][];
  /** Rows read but not pushable (they fail the wire schema); skipped this run. */
  invalid: number;
  /** Key to continue reading after, or null when there is nothing more. */
  nextKey: string | null;
}

/** What merging one pulled page changed. */
export interface MergeOutcome {
  /** Rows written locally. */
  applied: number;
  /** Rows dropped: duplicates, older LWW values, unknown settings or cards. */
  ignored: number;
  /** Cards whose review logs changed (their state needs rebuilding). */
  affectedCards: Set<string>;
  /** True when study sessions were added (the streak needs replaying). */
  sessionsChanged: boolean;
  /** True when the desired retention setting changed (every card needs rebuilding). */
  schedulerChanged: boolean;
}

/** Context for reading and merging. */
export interface LocalContext {
  /** This device's id, sent with LWW rows that this device wrote. */
  deviceId: string;
  now: Date;
}

const iso = (d: Date): string => d.toISOString();
const ms = (s: string): Date => new Date(Date.parse(s));

/** Total order of LWW writes: later time wins, then the larger device id (code unit order). */
export function isNewer(
  incoming: { updatedAt: Date; deviceId: string },
  local: { updatedAt: Date; deviceId: string } | null,
): boolean {
  if (local === null) return true;
  const dt = incoming.updatedAt.getTime() - local.updatedAt.getTime();
  if (dt !== 0) return dt > 0;
  return incoming.deviceId > local.deviceId;
}

// ---------------------------------------------------------------------------
// Cards from deterministic ids
// ---------------------------------------------------------------------------

const CARD_ID_RE = /^([a-z_]+):(\d+):([a-z_]+)$/u;

/** The kind, target and prompt mode encoded in a card id from {@link cardIdFor}, or null. */
export function parseCardId(
  id: string,
): { kind: CardKind; targetId: number; promptMode: PromptMode } | null {
  const match = CARD_ID_RE.exec(id);
  if (match === null) return null;
  const [, kind, target, mode] = match;
  if (!CARD_KINDS.includes(kind as CardKind) || !PROMPT_MODES.includes(mode as PromptMode)) {
    return null;
  }
  const targetId = Number(target);
  if (!Number.isSafeInteger(targetId)) return null;
  const parsed = { kind: kind as CardKind, targetId, promptMode: mode as PromptMode };
  return cardIdFor(parsed.kind, parsed.targetId, parsed.promptMode) === id ? parsed : null;
}

/**
 * Make sure the card `id` exists, creating it as a new card at `at` when its
 * id can be decoded. Returns false when the card is missing and its id is not
 * one this app version understands.
 */
function ensureCard(tx: AppDatabase, id: string, at: Date, scheduler: Scheduler): boolean {
  if (tx.select({ id: card.id }).from(card).where(eq(card.id, id)).get()) return true;
  const parsed = parseCardId(id);
  if (parsed === null) return false;
  tx.insert(card)
    .values({ id, ...parsed, ...scheduler.newCard(at), createdAt: at })
    .onConflictDoNothing()
    .run();
  return true;
}

/**
 * Rebuild the FSRS state of `cardIds` by replaying all their logs. Cards
 * without logs are left alone.
 *
 * @returns the number of cards rebuilt
 */
export function rebuildCards(
  tx: AppDatabase,
  cardIds: Iterable<string>,
  scheduler: Scheduler,
): number {
  let rebuilt = 0;
  for (const part of chunk([...new Set(cardIds)], MAX_IDS_PER_QUERY)) {
    const logs = tx
      .select({
        id: reviewLog.id,
        cardId: reviewLog.cardId,
        rating: reviewLog.rating,
        reviewedAt: reviewLog.reviewedAt,
      })
      .from(reviewLog)
      .where(inArray(reviewLog.cardId, part))
      .all();
    const byCard = new Map<string, typeof logs>();
    for (const log of logs) {
      const list = byCard.get(log.cardId);
      if (list) list.push(log);
      else byCard.set(log.cardId, [log]);
    }
    for (const [cardId, cardLogs] of byCard) {
      // createdAt defaults to the first log, so every device gets the same state.
      const schedule = rebuildCardState(cardLogs, { scheduler });
      tx.update(card).set(schedule).where(eq(card.id, cardId)).run();
      rebuilt += 1;
    }
  }
  return rebuilt;
}

/** Ids of every card that has review logs. */
export function cardsWithLogs(tx: AppDatabase): string[] {
  return tx
    .selectDistinct({ cardId: reviewLog.cardId })
    .from(reviewLog)
    .all()
    .map((r) => r.cardId);
}

// ---------------------------------------------------------------------------
// Reading unsynced rows
// ---------------------------------------------------------------------------

function batchOf<K extends SyncTable, R>(
  raw: R[],
  limit: number,
  key: (r: R) => string,
  toDto: (r: R) => SyncRowMap[K] | null,
): UnsyncedBatch<K> {
  const rows: SyncRowMap[K][] = [];
  let invalid = 0;
  for (const r of raw) {
    const dto = toDto(r);
    if (dto === null) invalid += 1;
    else rows.push(dto);
  }
  const last = raw.at(-1);
  return { rows, invalid, nextKey: last !== undefined && raw.length === limit ? key(last) : null };
}

type Validator<K extends SyncTable> = (dto: unknown) => SyncRowMap[K] | null;

/**
 * Read up to `limit` rows of `table` that still need pushing, in primary key
 * order after `afterKey`. Rows that fail `validate` are counted, not returned.
 */
export function readUnsynced<K extends SyncTable>(
  db: AppDatabase,
  table: K,
  afterKey: string | null,
  limit: number,
  ctx: LocalContext,
  validate: Validator<K>,
): UnsyncedBatch<K> {
  const v = validate as Validator<SyncTable>;
  switch (table) {
    case 'review_log': {
      const raw = db
        .select()
        .from(reviewLog)
        .where(
          and(
            isNull(reviewLog.syncedAt),
            afterKey === null ? undefined : gt(reviewLog.id, afterKey),
          ),
        )
        .orderBy(asc(reviewLog.id))
        .limit(limit)
        .all();
      return batchOf<K, (typeof raw)[number]>(
        raw,
        limit,
        (r) => r.id,
        (r) =>
          v({
            id: r.id,
            cardId: r.cardId,
            rating: r.rating,
            answer: r.answer,
            latencyMs: r.latencyMs,
            reviewedAt: iso(r.reviewedAt),
            deviceId: r.deviceId,
          } satisfies ReviewLogDto) as SyncRowMap[K] | null,
      );
    }
    case 'card_flag': {
      const raw = db
        .select({
          id: card.id,
          suspended: card.suspended,
          flagUpdatedAt: card.flagUpdatedAt,
          flagDeviceId: card.flagDeviceId,
        })
        .from(card)
        .where(
          and(
            isNull(card.flagSyncedAt),
            isNotNull(card.flagUpdatedAt),
            afterKey === null ? undefined : gt(card.id, afterKey),
          ),
        )
        .orderBy(asc(card.id))
        .limit(limit)
        .all();
      return batchOf<K, (typeof raw)[number]>(
        raw,
        limit,
        (r) => r.id,
        (r) =>
          r.flagUpdatedAt === null
            ? null
            : (v({
                cardId: r.id,
                suspended: r.suspended,
                updatedAt: iso(r.flagUpdatedAt),
                deviceId: r.flagDeviceId ?? ctx.deviceId,
              } satisfies CardFlagDto) as SyncRowMap[K] | null),
      );
    }
    case 'setting': {
      const raw = db
        .select()
        .from(settings)
        .where(
          and(
            isNull(settings.syncedAt),
            afterKey === null ? undefined : gt(settings.key, afterKey),
          ),
        )
        .orderBy(asc(settings.key))
        .limit(limit)
        .all();
      return batchOf<K, (typeof raw)[number]>(
        raw,
        limit,
        (r) => r.key,
        (r) =>
          v({
            key: r.key,
            value: r.value as JsonValue,
            updatedAt: iso(r.updatedAt),
            deviceId: r.deviceId ?? ctx.deviceId,
          } satisfies SettingDto) as SyncRowMap[K] | null,
      );
    }
    case 'study_session': {
      const raw = db
        .select()
        .from(studySession)
        .where(
          and(
            isNull(studySession.syncedAt),
            isNotNull(studySession.endedAt),
            afterKey === null ? undefined : gt(studySession.id, afterKey),
          ),
        )
        .orderBy(asc(studySession.id))
        .limit(limit)
        .all();
      return batchOf<K, (typeof raw)[number]>(
        raw,
        limit,
        (r) => r.id,
        (r) =>
          r.endedAt === null
            ? null
            : (v({
                id: r.id,
                startedAt: iso(r.startedAt),
                endedAt: iso(r.endedAt),
                minutesActive: r.minutesActive,
                activities: r.activities,
              } satisfies StudySessionDto) as SyncRowMap[K] | null),
      );
    }
    case 'error_record': {
      const raw = db
        .select()
        .from(errorRecord)
        .where(
          and(
            isNull(errorRecord.syncedAt),
            afterKey === null ? undefined : gt(errorRecord.id, afterKey),
          ),
        )
        .orderBy(asc(errorRecord.id))
        .limit(limit)
        .all();
      return batchOf<K, (typeof raw)[number]>(
        raw,
        limit,
        (r) => r.id,
        (r) =>
          v({
            id: r.id,
            category: r.category,
            example: r.example,
            source: r.source,
            cardId: r.cardId,
            createdAt: iso(r.createdAt),
          } satisfies ErrorRecordDto) as SyncRowMap[K] | null,
      );
    }
  }
  throw new RangeError(`unknown sync table: ${String(table)}`);
}

// ---------------------------------------------------------------------------
// Marking pushed rows
// ---------------------------------------------------------------------------

/**
 * Mark pushed rows as synced. LWW rows are marked only if they still hold the
 * pushed version, so a change made while the push was in flight is pushed
 * next time.
 */
export function markPushed<K extends SyncTable>(
  db: AppDatabase,
  table: K,
  rows: readonly SyncRowMap[K][],
  now: Date,
): void {
  const list = rows as readonly unknown[];
  const t: SyncTable = table;
  db.transaction((tx) => {
    if (t === 'review_log' || t === 'study_session' || t === 'error_record') {
      const ids = (list as readonly { id: string }[]).map((r) => r.id);
      for (const part of chunk(ids, MAX_IDS_PER_QUERY)) {
        if (t === 'review_log') {
          tx.update(reviewLog)
            .set({ syncedAt: now })
            .where(and(inArray(reviewLog.id, part), isNull(reviewLog.syncedAt)))
            .run();
        } else if (t === 'study_session') {
          tx.update(studySession)
            .set({ syncedAt: now })
            .where(and(inArray(studySession.id, part), isNull(studySession.syncedAt)))
            .run();
        } else {
          tx.update(errorRecord)
            .set({ syncedAt: now })
            .where(and(inArray(errorRecord.id, part), isNull(errorRecord.syncedAt)))
            .run();
        }
      }
    } else if (t === 'card_flag') {
      for (const r of list as readonly CardFlagDto[]) {
        tx.update(card)
          .set({ flagSyncedAt: now })
          .where(and(eq(card.id, r.cardId), eq(card.flagUpdatedAt, ms(r.updatedAt))))
          .run();
      }
    } else {
      for (const r of list as readonly SettingDto[]) {
        tx.update(settings)
          .set({ syncedAt: now })
          .where(and(eq(settings.key, r.key), eq(settings.updatedAt, ms(r.updatedAt))))
          .run();
      }
    }
  });
}

/**
 * Forget what was pushed: every row becomes unsynced again, so it is pushed
 * to the (new) account on the next sync. Only the `synced_at` markers change;
 * review logs stay immutable.
 */
export function markAllUnsynced(tx: AppDatabase): void {
  tx.update(reviewLog).set({ syncedAt: null }).where(isNotNull(reviewLog.syncedAt)).run();
  tx.update(studySession).set({ syncedAt: null }).where(isNotNull(studySession.syncedAt)).run();
  tx.update(errorRecord).set({ syncedAt: null }).where(isNotNull(errorRecord.syncedAt)).run();
  tx.update(settings).set({ syncedAt: null }).where(isNotNull(settings.syncedAt)).run();
  tx.update(card).set({ flagSyncedAt: null }).where(isNotNull(card.flagSyncedAt)).run();
}

// ---------------------------------------------------------------------------
// Merging pulled rows
// ---------------------------------------------------------------------------

function emptyOutcome(): MergeOutcome {
  return {
    applied: 0,
    ignored: 0,
    affectedCards: new Set(),
    sessionsChanged: false,
    schedulerChanged: false,
  };
}

/** The local device id of a row written by `deviceId` (null when it is this device). */
const localDevice = (deviceId: string, ctx: LocalContext): string | null =>
  deviceId === ctx.deviceId ? null : deviceId;

function mergeReviewLogs(
  tx: AppDatabase,
  rows: ReviewLogDto[],
  ctx: LocalContext,
  scheduler: Scheduler,
  out: MergeOutcome,
): void {
  for (const r of rows) {
    const reviewedAt = ms(r.reviewedAt);
    if (!ensureCard(tx, r.cardId, reviewedAt, scheduler)) {
      out.ignored += 1;
      continue;
    }
    const inserted = tx
      .insert(reviewLog)
      .values({
        id: r.id,
        cardId: r.cardId,
        rating: r.rating,
        answer: r.answer,
        latencyMs: r.latencyMs,
        reviewedAt,
        deviceId: r.deviceId,
        syncedAt: ctx.now,
      })
      .onConflictDoNothing({ target: reviewLog.id })
      .returning({ id: reviewLog.id })
      .all();
    if (inserted.length > 0) {
      out.applied += 1;
      out.affectedCards.add(r.cardId);
    } else {
      out.ignored += 1;
    }
  }
}

function mergeCardFlags(
  tx: AppDatabase,
  rows: CardFlagDto[],
  ctx: LocalContext,
  scheduler: Scheduler,
  out: MergeOutcome,
): void {
  for (const r of rows) {
    const updatedAt = ms(r.updatedAt);
    if (!ensureCard(tx, r.cardId, updatedAt, scheduler)) {
      out.ignored += 1;
      continue;
    }
    const local = tx
      .select({ updatedAt: card.flagUpdatedAt, deviceId: card.flagDeviceId })
      .from(card)
      .where(eq(card.id, r.cardId))
      .get();
    const current =
      local?.updatedAt == null
        ? null
        : { updatedAt: local.updatedAt, deviceId: local.deviceId ?? ctx.deviceId };
    if (!isNewer({ updatedAt, deviceId: r.deviceId }, current)) {
      out.ignored += 1;
      continue;
    }
    tx.update(card)
      .set({
        suspended: r.suspended,
        flagUpdatedAt: updatedAt,
        flagDeviceId: localDevice(r.deviceId, ctx),
        flagSyncedAt: ctx.now,
      })
      .where(eq(card.id, r.cardId))
      .run();
    out.applied += 1;
  }
}

function mergeSettings(
  tx: AppDatabase,
  rows: SettingDto[],
  ctx: LocalContext,
  out: MergeOutcome,
): void {
  for (const r of rows) {
    if (!isSettingKey(r.key) || !SETTINGS_SCHEMA[r.key].safeParse(r.value).success) {
      out.ignored += 1; // unknown to this app version, or no longer valid
      continue;
    }
    const updatedAt = ms(r.updatedAt);
    const local = tx.select().from(settings).where(eq(settings.key, r.key)).get();
    const current = local
      ? { updatedAt: local.updatedAt, deviceId: local.deviceId ?? ctx.deviceId }
      : null;
    if (!isNewer({ updatedAt, deviceId: r.deviceId }, current)) {
      out.ignored += 1;
      continue;
    }
    const row = {
      value: r.value,
      updatedAt,
      deviceId: localDevice(r.deviceId, ctx),
      syncedAt: ctx.now,
    };
    tx.insert(settings)
      .values({ key: r.key, ...row })
      .onConflictDoUpdate({ target: settings.key, set: row })
      .run();
    out.applied += 1;
    if (r.key === 'desiredRetention' && JSON.stringify(local?.value) !== JSON.stringify(r.value)) {
      out.schedulerChanged = true;
    }
  }
}

function mergeSessions(
  tx: AppDatabase,
  rows: StudySessionDto[],
  ctx: LocalContext,
  out: MergeOutcome,
): void {
  for (const r of rows) {
    const inserted = tx
      .insert(studySession)
      .values({
        id: r.id,
        startedAt: ms(r.startedAt),
        endedAt: ms(r.endedAt),
        minutesActive: r.minutesActive,
        activities: r.activities,
        syncedAt: ctx.now,
      })
      .onConflictDoNothing({ target: studySession.id })
      .returning({ id: studySession.id })
      .all();
    if (inserted.length > 0) {
      out.applied += 1;
      out.sessionsChanged = true;
    } else {
      out.ignored += 1;
    }
  }
}

function mergeErrors(
  tx: AppDatabase,
  rows: ErrorRecordDto[],
  ctx: LocalContext,
  scheduler: Scheduler,
  out: MergeOutcome,
): void {
  for (const r of rows) {
    const createdAt = ms(r.createdAt);
    const cardId =
      r.cardId !== null && ensureCard(tx, r.cardId, createdAt, scheduler) ? r.cardId : null;
    const inserted = tx
      .insert(errorRecord)
      .values({
        id: r.id,
        category: r.category,
        example: r.example,
        source: r.source,
        cardId,
        createdAt,
        syncedAt: ctx.now,
      })
      .onConflictDoNothing({ target: errorRecord.id })
      .returning({ id: errorRecord.id })
      .all();
    if (inserted.length > 0) out.applied += 1;
    else out.ignored += 1;
  }
}

/** Merge one pulled page into the database (the caller provides the transaction). */
export function mergePulled<K extends SyncTable>(
  tx: AppDatabase,
  page: PullResponseFor<K>,
  ctx: LocalContext,
  scheduler: Scheduler,
): MergeOutcome {
  const out = emptyOutcome();
  const rows = page.rows.map((r) => r.row);
  switch (page.table) {
    case 'review_log':
      mergeReviewLogs(tx, rows as ReviewLogDto[], ctx, scheduler, out);
      break;
    case 'card_flag':
      mergeCardFlags(tx, rows as CardFlagDto[], ctx, scheduler, out);
      break;
    case 'setting':
      mergeSettings(tx, rows as SettingDto[], ctx, out);
      break;
    case 'study_session':
      mergeSessions(tx, rows as StudySessionDto[], ctx, out);
      break;
    case 'error_record':
      mergeErrors(tx, rows as ErrorRecordDto[], ctx, scheduler, out);
      break;
  }
  return out;
}

/** Number of local rows still to push, for status display. */
export function countUnsynced(db: AppDatabase): number {
  const n = (q: { n: number } | undefined) => q?.n ?? 0;
  return (
    n(
      db
        .select({ n: sql<number>`count(*)` })
        .from(reviewLog)
        .where(isNull(reviewLog.syncedAt))
        .get(),
    ) +
    n(
      db
        .select({ n: sql<number>`count(*)` })
        .from(studySession)
        .where(and(isNull(studySession.syncedAt), isNotNull(studySession.endedAt)))
        .get(),
    ) +
    n(
      db
        .select({ n: sql<number>`count(*)` })
        .from(errorRecord)
        .where(isNull(errorRecord.syncedAt))
        .get(),
    ) +
    n(
      db
        .select({ n: sql<number>`count(*)` })
        .from(settings)
        .where(isNull(settings.syncedAt))
        .get(),
    ) +
    n(
      db
        .select({ n: sql<number>`count(*)` })
        .from(card)
        .where(and(isNull(card.flagSyncedAt), isNotNull(card.flagUpdatedAt)))
        .get(),
    )
  );
}
