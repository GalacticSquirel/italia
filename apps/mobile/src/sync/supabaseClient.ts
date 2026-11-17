// supabase-js builds request URLs with URL/URLSearchParams APIs that React
// Native only partly implements; Supabase's React Native guide uses this polyfill.
import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

import { SYNC_DB_SCHEMA, type SyncTable } from '@italia/api-contract';

import type { SupabaseConfig } from './config';
import { createChunkedSecureStorage } from './secureStorage';
import type { SyncBackend } from './supabaseTransport';

/**
 * Create the app's Supabase client. The session lives in the platform
 * keystore (chunked SecureStore), readable after the first unlock so a
 * background sync can refresh it. Sign-in links use the PKCE flow. Queries
 * go to the `italia` schema, where the sync tables live.
 */
export function createSupabaseClient(config: SupabaseConfig) {
  const options = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };
  const storage = createChunkedSecureStorage({
    getItemAsync: (key) => SecureStore.getItemAsync(key, options),
    setItemAsync: (key, value) => SecureStore.setItemAsync(key, value, options),
    deleteItemAsync: (key) => SecureStore.deleteItemAsync(key, options),
  });
  return createClient(config.url, config.anonKey, {
    db: { schema: SYNC_DB_SCHEMA },
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });
}

/** The app's Supabase client, bound to the sync schema. */
export type SyncSupabaseClient = ReturnType<typeof createSupabaseClient>;

/** {@link SyncBackend} over a Supabase client. */
export function supabaseSyncBackend(client: SyncSupabaseClient): SyncBackend {
  return {
    async getUserId() {
      const { data, error } = await client.auth.getSession();
      return { userId: data.session?.user.id ?? null, error };
    },
    async upsert(table: SyncTable, rows, options) {
      const { error } = await client.from(table).upsert(rows, options);
      return { error };
    },
    async selectSince(table: SyncTable, columns, after, limit) {
      const { data, error } = await client
        .from(table)
        .select(columns)
        .gt('server_seq', after)
        .order('server_seq', { ascending: true })
        .limit(limit);
      return { data: data as unknown, error };
    },
  };
}
