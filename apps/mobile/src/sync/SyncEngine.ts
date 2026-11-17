import {
  PullRequestSchema,
  PullResponseSchema,
  PushRequestSchema,
  SYNC_BATCH_MAX,
  SYNC_ROW_SCHEMAS,
  SYNC_TABLES,
  type PullResponse,
  type PullResponseFor,
  type PushRequest,
  type SyncTable,
} from '@italia/api-contract';
import {
  createScheduler,
  localDateInTimeZone,
  replayStreak,
  type Scheduler,
  type StreakConfig,
} from '@italia/core';

import { markCardStatesRetention } from '@/data/cardState';
import { newUuid, type IdGenerator } from '@/data/ids';
import { createMetaRepo, META_KEYS, type MetaKey } from '@/data/MetaRepo';
import { createSettingsRepo } from '@/data/SettingsRepo';
import { createStreakRepo } from '@/data/StreakRepo';
import { studySession } from '@/db/schema';
import type { AppDatabase } from '@/db/types';

import {
  cardsWithLogs,
  countUnsynced,
  markAllUnsynced,
  markPushed,
  mergePulled,
  readUnsynced,
  rebuildCards,
  type LocalContext,
  type UnsyncedBatch,
} from './localStore';
import { SyncTransportError, type SyncTransport } from './transport';

/** Why a sync was started. */
export type SyncReason = 'manual' | 'foreground' | 'session_ended' | 'sign_in' | 'retry';

/** Per-table counts. */
export type TableCounts = Record<SyncTable, number>;

/** What one sync run did. */
export type SyncResult =
  | { status: 'skipped'; reason: 'signed_out' }
  | {
      status: 'ok';
      pushed: TableCounts;
      /** Rows that could not be pushed because they fail the wire schema. */
      unpushable: number;
      pulled: TableCounts;
      /** Pulled rows actually written locally (new or newer). */
      applied: number;
      rebuiltCards: number;
      streakReplayed: boolean;
    }
  | { status: 'error'; error: Error };

/** The engine's state, for the UI. */
export interface SyncStatus {
  state: 'idle' | 'syncing' | 'error' | 'signed_out';
  /** When the last sync finished without error, or null. */
  lastSuccessAt: Date | null;
  /** Message of the last error, while `state` is `error`. */
  lastError: string | null;
  /** When the next automatic retry is due, or null. */
  nextRetryAt: Date | null;
  /** Local changes not yet pushed (as of the last run). */
  pending: number;
}

/** Timer functions; injectable for tests. */
export interface SyncTimers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

/** Options for {@link SyncEngine}. */
export interface SyncEngineOptions {
  db: AppDatabase;
  transport: SyncTransport;
  /** Generates this device's id if it has none yet; defaults to random UUIDs. */
  newId?: IdGenerator;
  /** Clock; defaults to `new Date()`. */
  now?: () => Date;
  /**
   * The scheduler used to rebuild card state; must match the one used for
   * live reviews. Defaults to `createScheduler` with the synced desired retention.
   */
  scheduler?: (db: AppDatabase) => Scheduler;
  /** Streak rules for replaying the streak from sessions; defaults to the device time zone. */
  streakConfig?: StreakConfig;
  /** Rows per push or pull request; at most {@link SYNC_BATCH_MAX}. */
  batchSize?: number;
  /** First retry delay after a failure; doubles each failure up to `maxRetryMs`. Default 5 s. */
  baseRetryMs?: number;
  /** Longest retry delay. Default 15 min. */
  maxRetryMs?: number;
  /** Returns a number in [0, 1) for retry jitter; defaults to Math.random. */
  random?: () => number;
  timers?: SyncTimers;
  /** Lets the UI breathe between batches; defaults to a zero-delay timeout. */
  yieldToUi?: () => Promise<void>;
}

const CURSOR_KEYS: Record<SyncTable, MetaKey> = {
  review_log: META_KEYS.syncCursorReviewLog,
  card_flag: META_KEYS.syncCursorCardFlag,
  setting: META_KEYS.syncCursorSetting,
  study_session: META_KEYS.syncCursorStudySession,
  error_record: META_KEYS.syncCursorErrorRecord,
};

/**
 * Pull order: settings first so a changed desired retention is in place
 * before cards are rebuilt from pulled logs.
 */
const PULL_ORDER: readonly SyncTable[] = [
  'setting',
  'card_flag',
  'review_log',
  'study_session',
  'error_record',
];

const zeroCounts = (): TableCounts =>
  Object.fromEntries(SYNC_TABLES.map((t) => [t, 0])) as TableCounts;

function defaultScheduler(db: AppDatabase): Scheduler {
  return createScheduler({ desiredRetention: createSettingsRepo(db).get('desiredRetention') });
}

function deviceStreakConfig(): StreakConfig {
  return { localDate: localDateInTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone) };
}

const defaultTimers: SyncTimers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => {
    clearTimeout(handle as ReturnType<typeof setTimeout>);
  },
};

function asError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

/**
 * Local-first sync of learner data with the server (ADR 0002, docs/sync.md).
 *
 * A run pushes every local row not yet synced, in batches, then pulls each
 * table's rows since its cursor and merges them, one batch per SQLite
 * transaction (merge, rebuilt card states and the new cursor commit
 * together). Every step is idempotent, so a run that fails part-way resumes
 * where it stopped. Runs never overlap: a request during a run schedules one
 * more run afterwards. Failures are retried with exponential backoff.
 *
 * Nothing here is on the UI's critical path: the app reads and writes SQLite
 * as usual, and sync only adds rows in the background.
 */
export class SyncEngine {
  private readonly db: AppDatabase;
  private readonly transport: SyncTransport;
  private readonly now: () => Date;
  private readonly newId: IdGenerator;
  private readonly makeScheduler: (db: AppDatabase) => Scheduler;
  private readonly streakConfig: StreakConfig;
  private readonly batchSize: number;
  private readonly baseRetryMs: number;
  private readonly maxRetryMs: number;
  private readonly random: () => number;
  private readonly timers: SyncTimers;
  private readonly yieldToUi: () => Promise<void>;

  private running: Promise<SyncResult> | null = null;
  private rerun = false;
  private failures = 0;
  private retryHandle: unknown = null;
  private disposed = false;
  private readonly listeners = new Set<(status: SyncStatus) => void>();
  private current: SyncStatus;

  constructor(options: SyncEngineOptions) {
    this.db = options.db;
    this.transport = options.transport;
    this.now = options.now ?? (() => new Date());
    this.newId = options.newId ?? newUuid;
    this.makeScheduler = options.scheduler ?? defaultScheduler;
    this.streakConfig = options.streakConfig ?? deviceStreakConfig();
    this.batchSize = Math.min(options.batchSize ?? SYNC_BATCH_MAX, SYNC_BATCH_MAX);
    if (!Number.isSafeInteger(this.batchSize) || this.batchSize < 1) {
      throw new RangeError('batchSize must be a whole number from 1 to 500');
    }
    this.baseRetryMs = options.baseRetryMs ?? 5_000;
    this.maxRetryMs = options.maxRetryMs ?? 15 * 60_000;
    this.random = options.random ?? Math.random;
    this.timers = options.timers ?? defaultTimers;
    this.yieldToUi =
      options.yieldToUi ??
      (() =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, 0);
        }));
    const last = createMetaRepo(this.db, this.newId).get(META_KEYS.syncLastSuccessAt);
    this.current = {
      state: 'idle',
      lastSuccessAt: last === null ? null : new Date(last),
      lastError: null,
      nextRetryAt: null,
      pending: 0,
    };
  }

  /** The current status. */
  get status(): SyncStatus {
    return this.current;
  }

  /** Call `listener` on every status change. Returns an unsubscribe function. */
  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Start a sync in the background and return immediately. Use this from UI
   * events (app foreground, a session ending, a button).
   */
  requestSync(reason: SyncReason): void {
    void this.sync(reason);
  }

  /**
   * Run a sync and resolve with its result; never rejects. If a run is in
   * progress, one more run is queued after it and this resolves with the
   * queued run's result.
   */
  sync(reason: SyncReason = 'manual'): Promise<SyncResult> {
    if (this.disposed) return Promise.resolve({ status: 'skipped', reason: 'signed_out' });
    if (reason !== 'retry') this.clearRetry();
    if (this.running !== null) {
      // The running loop goes round once more and resolves with that run.
      this.rerun = true;
      return this.running;
    }
    const run = this.runLoop();
    this.running = run;
    return run;
  }

  /**
   * Forget all sync state on this device: cursors and synced markers. The
   * next sync pushes every row and pulls everything again (both idempotent).
   */
  reset(): void {
    const meta = createMetaRepo(this.db, this.newId);
    this.db.transaction((tx) => {
      const txMeta = createMetaRepo(tx, this.newId);
      for (const key of Object.values(CURSOR_KEYS)) txMeta.remove(key);
      txMeta.remove(META_KEYS.syncLastSuccessAt);
      markAllUnsynced(tx);
    });
    meta.remove(META_KEYS.syncUserId);
    this.update({ lastSuccessAt: null });
  }

  /** Stop retries and ignore further requests. */
  dispose(): void {
    this.disposed = true;
    this.clearRetry();
    this.listeners.clear();
  }

  // -------------------------------------------------------------------------

  private async runLoop(): Promise<SyncResult> {
    let result: SyncResult;
    do {
      this.rerun = false;
      result = await this.runOnce();
    } while (this.takeRerun() && result.status === 'ok' && !this.disposed);
    this.running = null;
    return result;
  }

  /** Whether a run was requested while the last one ran (set from other calls meanwhile). */
  private takeRerun(): boolean {
    const rerun = this.rerun;
    this.rerun = false;
    return rerun;
  }

  private async runOnce(): Promise<SyncResult> {
    let userId: string | null;
    try {
      userId = await this.transport.getUserId();
    } catch (e) {
      return this.fail(asError(e));
    }
    if (userId === null) {
      this.failures = 0;
      this.update({ state: 'signed_out', lastError: null, nextRetryAt: null });
      return { status: 'skipped', reason: 'signed_out' };
    }
    this.update({ state: 'syncing', lastError: null, nextRetryAt: null });
    try {
      this.bindUser(userId);
      const ctx: LocalContext = {
        deviceId: createMetaRepo(this.db, this.newId).getOrCreateDeviceId(),
        now: this.now(),
      };
      const { pushed, unpushable } = await this.pushAll(ctx);
      const pulled = await this.pullAll(ctx);
      const finishedAt = this.now();
      createMetaRepo(this.db, this.newId).set(
        META_KEYS.syncLastSuccessAt,
        finishedAt.toISOString(),
        finishedAt,
      );
      this.failures = 0;
      this.update({
        state: 'idle',
        lastSuccessAt: finishedAt,
        lastError: null,
        pending: countUnsynced(this.db),
      });
      return { status: 'ok', pushed, unpushable, ...pulled };
    } catch (e) {
      return this.fail(asError(e));
    }
  }

  /** A different account than last time: start its sync from scratch. */
  private bindUser(userId: string): void {
    const meta = createMetaRepo(this.db, this.newId);
    const previous = meta.get(META_KEYS.syncUserId);
    if (previous === userId) return;
    if (previous !== null) this.reset();
    meta.set(META_KEYS.syncUserId, userId, this.now());
  }

  private async pushAll(ctx: LocalContext): Promise<{ pushed: TableCounts; unpushable: number }> {
    const pushed = zeroCounts();
    let unpushable = 0;
    for (const table of SYNC_TABLES) {
      const validate = (dto: unknown) => {
        const parsed = SYNC_ROW_SCHEMAS[table].safeParse(dto);
        return parsed.success ? parsed.data : null;
      };
      let after: string | null = null;
      do {
        const batch: UnsyncedBatch<typeof table> = readUnsynced(
          this.db,
          table,
          after,
          this.batchSize,
          ctx,
          validate,
        );
        unpushable += batch.invalid;
        if (batch.rows.length > 0) {
          const request: PushRequest = PushRequestSchema.parse({ table, rows: batch.rows });
          await this.transport.push(request);
          markPushed(this.db, table, batch.rows, this.now());
          pushed[table] += batch.rows.length;
        }
        after = batch.nextKey;
        await this.yieldToUi();
      } while (after !== null);
    }
    return { pushed, unpushable };
  }

  private async pullAll(ctx: LocalContext): Promise<{
    pulled: TableCounts;
    applied: number;
    rebuiltCards: number;
    streakReplayed: boolean;
  }> {
    const pulled = zeroCounts();
    let applied = 0;
    let rebuiltCards = 0;
    const changed = { sessions: false };
    const meta = createMetaRepo(this.db, this.newId);
    for (const table of PULL_ORDER) {
      let hasMore = true;
      while (hasMore) {
        const after = Number(meta.get(CURSOR_KEYS[table]) ?? '0');
        const request = PullRequestSchema.parse({ table, after, limit: this.batchSize });
        const page: PullResponse = PullResponseSchema.parse(await this.transport.pull(request));
        if (page.table !== table) {
          throw new SyncTransportError(`pulled ${page.table} when asking for ${table}`, false);
        }
        if (page.rows.some((r) => r.serverSeq <= after)) {
          throw new SyncTransportError(`pulled ${table} rows at or before the cursor`, false);
        }
        const last = page.rows.at(-1);
        this.db.transaction((tx) => {
          const scheduler = this.makeScheduler(tx);
          const outcome = mergePulled(tx, page as PullResponseFor<typeof table>, ctx, scheduler);
          applied += outcome.applied;
          changed.sessions ||= outcome.sessionsChanged;
          // A pulled desired retention changes the scheduler: rebuild every card with it.
          const toRebuild = outcome.schedulerChanged ? cardsWithLogs(tx) : outcome.affectedCards;
          const replayWith = outcome.schedulerChanged ? this.makeScheduler(tx) : scheduler;
          rebuiltCards += rebuildCards(tx, toRebuild, replayWith);
          if (outcome.schedulerChanged) {
            markCardStatesRetention(tx, replayWith.desiredRetention, ctx.now);
          }
          if (last !== undefined) {
            createMetaRepo(tx, this.newId).set(CURSOR_KEYS[table], String(last.serverSeq), ctx.now);
          }
        });
        pulled[table] += page.rows.length;
        hasMore = page.hasMore && last !== undefined;
        await this.yieldToUi();
      }
    }
    if (changed.sessions) this.replayStreak();
    return { pulled, applied, rebuiltCards, streakReplayed: changed.sessions };
  }

  /** The streak is not synced; derive it from all sessions, now including other devices'. */
  private replayStreak(): void {
    const sessions = this.db
      .select({
        id: studySession.id,
        startedAt: studySession.startedAt,
        endedAt: studySession.endedAt,
        minutesActive: studySession.minutesActive,
        activities: studySession.activities,
      })
      .from(studySession)
      .all();
    const state = replayStreak(sessions, this.streakConfig);
    const streak = createStreakRepo(this.db);
    const stored = streak.get();
    streak.save(
      { ...state, longestDays: Math.max(state.longestDays, stored.longestDays) },
      this.now(),
    );
  }

  private fail(error: Error): SyncResult {
    this.failures += 1;
    const retryable = !(error instanceof SyncTransportError) || error.retryable;
    let nextRetryAt: Date | null = null;
    if (retryable && !this.disposed) {
      const exp = this.baseRetryMs * 2 ** Math.min(this.failures - 1, 20);
      const delay = Math.min(this.maxRetryMs, exp) * (0.5 + this.random() / 2);
      nextRetryAt = new Date(this.now().getTime() + delay);
      this.clearRetry();
      this.retryHandle = this.timers.setTimeout(() => {
        this.retryHandle = null;
        this.requestSync('retry');
      }, delay);
    }
    this.update({
      state: 'error',
      lastError: error.message,
      nextRetryAt,
      pending: countUnsynced(this.db),
    });
    return { status: 'error', error };
  }

  private clearRetry(): void {
    if (this.retryHandle !== null) {
      this.timers.clearTimeout(this.retryHandle);
      this.retryHandle = null;
    }
  }

  private update(patch: Partial<SyncStatus>): void {
    this.current = { ...this.current, ...patch };
    for (const listener of this.listeners) listener(this.current);
  }
}
