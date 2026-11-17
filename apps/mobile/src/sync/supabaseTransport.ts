import {
  fromServerRow,
  SYNC_TABLE_SPECS,
  toServerRow,
  type PullResponse,
  type ServerRowInput,
  type SyncRowMap,
  type SyncTable,
} from '@italia/api-contract';

import { SyncTransportError, type SyncTransport } from './transport';

/** The error shape PostgREST and the auth client return. */
export interface BackendError {
  message: string;
  code?: string | undefined;
  status?: number | undefined;
}

/**
 * The few Supabase calls sync needs. {@link supabaseSyncBackend} implements it
 * over a real client; tests pass a fake.
 */
export interface SyncBackend {
  /** The stored session's user id (no network unless the token needs refreshing). */
  getUserId(): Promise<{ userId: string | null; error: BackendError | null }>;
  upsert(
    table: SyncTable,
    rows: ServerRowInput[],
    options: { onConflict: string; ignoreDuplicates: boolean },
  ): Promise<{ error: BackendError | null }>;
  /** Rows of `table` with `server_seq > after`, ordered by `server_seq`, at most `limit`. */
  selectSince(
    table: SyncTable,
    columns: string,
    after: number,
    limit: number,
  ): Promise<{ data: unknown; error: BackendError | null }>;
}

/**
 * Postgres errors a retry cannot fix: constraint, permission and row-level
 * security violations (classes 22, 23, 42). Everything else (network,
 * timeouts, expired tokens, server errors) is retried with backoff.
 */
function toTransportError(error: BackendError): SyncTransportError {
  const permanent = error.code !== undefined && /^(22|23|42)/u.test(error.code);
  return new SyncTransportError(error.message, !permanent, error.code);
}

/** A {@link SyncTransport} over Supabase (PostgREST with row-level security). */
export function createSupabaseTransport(backend: SyncBackend): SyncTransport {
  const requireUser = async (): Promise<string> => {
    const { userId, error } = await backend.getUserId();
    if (error) throw toTransportError(error);
    if (userId === null) throw new SyncTransportError('signed out', false);
    return userId;
  };

  return {
    async getUserId() {
      const { userId, error } = await backend.getUserId();
      if (error) throw toTransportError(error);
      return userId;
    },
    async push(request) {
      const userId = await requireUser();
      const spec = SYNC_TABLE_SPECS[request.table];
      const rows = (request.rows as SyncRowMap[SyncTable][]).map((row) =>
        toServerRow(request.table, row, userId),
      );
      const { error } = await backend.upsert(request.table, rows, {
        onConflict: spec.conflictColumns.join(','),
        // Append-only: ON CONFLICT DO NOTHING. LWW: DO UPDATE, guarded by a server trigger.
        ignoreDuplicates: spec.appendOnly,
      });
      if (error) throw toTransportError(error);
    },
    async pull(request) {
      const spec = SYNC_TABLE_SPECS[request.table];
      const { data, error } = await backend.selectSince(
        request.table,
        spec.selectColumns.join(','),
        request.after,
        request.limit,
      );
      if (error) throw toTransportError(error);
      if (!Array.isArray(data)) throw new SyncTransportError('pull returned no rows array', true);
      const rows = data.map((raw: unknown) => fromServerRow(request.table, raw));
      return { table: request.table, rows, hasMore: rows.length === request.limit } as PullResponse;
    },
  };
}
