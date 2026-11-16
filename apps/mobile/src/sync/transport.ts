import type { PullRequest, PullResponse, PushRequest } from '@italia/api-contract';

/**
 * Where the sync engine sends and fetches rows. The app uses the Supabase
 * implementation ({@link createSupabaseTransport}); tests use an in-memory
 * server. Implementations do not need to validate: the engine validates every
 * request before sending and every response on arrival with the zod schemas
 * in `@italia/api-contract`.
 */
export interface SyncTransport {
  /** The signed-in user's id, or null when signed out. Must not need the network. */
  getUserId(): Promise<string | null>;
  /**
   * Store a batch of rows for the signed-in user. Must be idempotent:
   * append-only rows the server already has are ignored, and last-writer-wins
   * rows only replace older ones.
   *
   * @throws when the batch was not stored (the engine retries it later)
   */
  push(request: PushRequest): Promise<void>;
  /** Rows of one table with `server_seq > request.after`, oldest first. */
  pull(request: PullRequest): Promise<PullResponse>;
}

/** A transport failure, with whether retrying later may help. */
export class SyncTransportError extends Error {
  constructor(
    message: string,
    /** False for errors a retry cannot fix (for example a rejected row). */
    readonly retryable: boolean,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'SyncTransportError';
  }
}
