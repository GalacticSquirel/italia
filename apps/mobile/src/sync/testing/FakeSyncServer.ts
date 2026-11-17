/**
 * Test-only in-memory sync server with the same semantics as the Supabase
 * migrations: rows scoped per user, a per-table increasing `server_seq`,
 * append-only tables that ignore duplicate ids, and last-writer-wins tables
 * that keep the greater (updatedAt, deviceId).
 */
import {
  SYNC_TABLES,
  type PullRequest,
  type PullResponse,
  type PushRequest,
  type SyncRowMap,
  type SyncTable,
} from '@italia/api-contract';

import type { SyncTransport } from '../transport';

interface StoredRow {
  serverSeq: number;
  row: SyncRowMap[SyncTable];
}

const keyOf = (table: SyncTable, row: SyncRowMap[SyncTable]): string => {
  switch (table) {
    case 'card_flag':
      return (row as SyncRowMap['card_flag']).cardId;
    case 'setting':
      return (row as SyncRowMap['setting']).key;
    case 'learner_sentence':
      return String((row as SyncRowMap['learner_sentence']).id);
    default:
      return (row as { id: string }).id;
  }
};

const LWW_TABLES: ReadonlySet<SyncTable> = new Set(['card_flag', 'setting']);

function newer(
  a: { updatedAt: string; deviceId: string },
  b: { updatedAt: string; deviceId: string },
) {
  const dt = Date.parse(a.updatedAt) - Date.parse(b.updatedAt);
  return dt !== 0 ? dt > 0 : a.deviceId > b.deviceId;
}

/** Hooks to make the next calls fail. */
export interface FailurePlan {
  /** Fail the push call with this 1-based index (counted across the transport's life). */
  pushNumber?: number;
  /** Fail the pull call with this 1-based index. */
  pullNumber?: number;
  /** Error to throw. */
  error?: Error;
}

/** An in-memory server shared by several fake devices. */
export class FakeSyncServer {
  private seq = new Map<SyncTable, number>();
  private readonly data = new Map<string, Map<SyncTable, Map<string, StoredRow>>>();

  private tables(userId: string): Map<SyncTable, Map<string, StoredRow>> {
    let t = this.data.get(userId);
    if (!t) {
      t = new Map(SYNC_TABLES.map((name) => [name, new Map()]));
      this.data.set(userId, t);
    }
    return t;
  }

  private nextSeq(table: SyncTable): number {
    const n = (this.seq.get(table) ?? 0) + 1;
    this.seq.set(table, n);
    return n;
  }

  /** Apply a push as the server would. */
  push(userId: string, request: PushRequest): void {
    const rows = this.tables(userId).get(request.table);
    if (!rows) throw new Error('unknown table');
    for (const row of request.rows as SyncRowMap[SyncTable][]) {
      const key = keyOf(request.table, row);
      const existing = rows.get(key);
      if (existing === undefined) {
        rows.set(key, { serverSeq: this.nextSeq(request.table), row: structuredClone(row) });
      } else if (
        LWW_TABLES.has(request.table) &&
        newer(row as SyncRowMap['setting'], existing.row as SyncRowMap['setting'])
      ) {
        rows.set(key, { serverSeq: this.nextSeq(request.table), row: structuredClone(row) });
      }
      // Append-only duplicates and older LWW writes are ignored.
    }
  }

  /** Answer a pull as the server would. */
  pull(userId: string, request: PullRequest): PullResponse {
    const rows = [...(this.tables(userId).get(request.table)?.values() ?? [])]
      .filter((r) => r.serverSeq > request.after)
      .sort((a, b) => a.serverSeq - b.serverSeq)
      .slice(0, request.limit)
      .map((r) => ({ serverSeq: r.serverSeq, row: structuredClone(r.row) }));
    return { table: request.table, rows, hasMore: rows.length === request.limit } as PullResponse;
  }

  /** All rows of `table` for `userId`, in server_seq order. */
  rows<K extends SyncTable>(userId: string, table: K): SyncRowMap[K][] {
    return [...(this.tables(userId).get(table)?.values() ?? [])]
      .sort((a, b) => a.serverSeq - b.serverSeq)
      .map((r) => r.row as SyncRowMap[K]);
  }

  /** A transport for one device, signed in as whatever `user()` returns. */
  transport(user: () => string | null): FakeTransport {
    return new FakeTransport(this, user);
  }
}

/** A device's connection to a {@link FakeSyncServer}, with call counts and failure injection. */
export class FakeTransport implements SyncTransport {
  pushCalls: PushRequest[] = [];
  pullCalls: PullRequest[] = [];
  failures: FailurePlan = {};
  /** When true every call fails as if offline. */
  offline = false;

  constructor(
    private readonly server: FakeSyncServer,
    private readonly user: () => string | null,
  ) {}

  getUserId(): Promise<string | null> {
    return Promise.resolve(this.user());
  }

  private requireUser(): string {
    const user = this.user();
    if (user === null) throw new Error('not signed in');
    return user;
  }

  push(request: PushRequest): Promise<void> {
    this.pushCalls.push(request);
    if (this.offline) return Promise.reject(new Error('network unavailable'));
    if (this.failures.pushNumber === this.pushCalls.length) {
      return Promise.reject(this.failures.error ?? new Error('push failed'));
    }
    this.server.push(this.requireUser(), request);
    return Promise.resolve();
  }

  pull(request: PullRequest): Promise<PullResponse> {
    this.pullCalls.push(request);
    if (this.offline) return Promise.reject(new Error('network unavailable'));
    if (this.failures.pullNumber === this.pullCalls.length) {
      return Promise.reject(this.failures.error ?? new Error('pull failed'));
    }
    return Promise.resolve(this.server.pull(this.requireUser(), request));
  }
}
