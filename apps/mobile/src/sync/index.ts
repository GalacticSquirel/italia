/**
 * Accounts and log-based sync with Supabase (ADR 0002, docs/sync.md).
 * Optional: without `EXPO_PUBLIC_SUPABASE_URL` and
 * `EXPO_PUBLIC_SUPABASE_ANON_KEY` the app runs fully local.
 */
export { AuthError, authCodeFromUrl, type AccountUser, type AuthService } from './auth';
export { readSupabaseConfig, type SupabaseConfig, type SupabaseEnv } from './config';
export { parseCardId } from './localStore';
export {
  SyncEngine,
  type SyncEngineOptions,
  type SyncReason,
  type SyncResult,
  type SyncStatus,
  type SyncTimers,
  type TableCounts,
} from './SyncEngine';
export {
  AUTH_REDIRECT_PATH,
  createSyncServices,
  SyncProvider,
  SyncServicesProvider,
  useSync,
  type SyncContextValue,
  type SyncProviderProps,
  type SyncServices,
  type SyncServicesProviderProps,
} from './SyncProvider';
export { createSupabaseTransport, type BackendError, type SyncBackend } from './supabaseTransport';
export { SyncTransportError, type SyncTransport } from './transport';
