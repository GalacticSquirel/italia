import * as Linking from 'expo-linking';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useDatabase } from '@/db/DatabaseProvider';
import type { AppDatabase } from '@/db/types';
import { STREAK_CONFIG } from '@/features/study/time';

import { createAuthService, type AccountUser, type AuthService } from './auth';
import { readSupabaseConfig, type SupabaseConfig } from './config';
import { createSupabaseClient, supabaseSyncBackend } from './supabaseClient';
import { createSupabaseTransport } from './supabaseTransport';
import { SyncEngine, type SyncResult, type SyncStatus } from './SyncEngine';

/** Deep link that magic-link emails open; also listed in supabase/config.toml. */
export const AUTH_REDIRECT_PATH = 'auth-callback';

/** Everything sync needs at runtime. */
export interface SyncServices {
  engine: SyncEngine;
  auth: AuthService;
  /** Token refresh control; Supabase recommends refreshing only while the app is in the foreground. */
  session?: { startAutoRefresh(): void; stopAutoRefresh(): void };
  /** The deep link sign-in emails open (`italia://auth-callback`). */
  redirectUrl?: string;
}

/** What screens get from {@link useSync}. */
export interface SyncContextValue {
  /** False when this build has no Supabase config: accounts and sync are off. */
  enabled: boolean;
  status: SyncStatus | null;
  user: AccountUser | null;
  auth: AuthService | null;
  /** The deep link that sign-in emails should open. */
  redirectUrl: string | null;
  /** Sync now and wait for the result (null when sync is off). */
  syncNow: () => Promise<SyncResult | null>;
  /** Tell sync that a study session ended, so its reviews are pushed soon. Never blocks. */
  notifySessionEnded: () => void;
}

const DISABLED: SyncContextValue = {
  enabled: false,
  status: null,
  user: null,
  auth: null,
  redirectUrl: null,
  syncNow: () => Promise.resolve(null),
  notifySessionEnded: () => undefined,
};

const SyncContext = createContext<SyncContextValue>(DISABLED);

/** Build the Supabase-backed sync services, or null when `config` is null. */
export function createSyncServices(
  db: AppDatabase,
  config: SupabaseConfig | null,
): SyncServices | null {
  if (config === null) return null;
  const client = createSupabaseClient(config);
  return {
    engine: new SyncEngine({
      db,
      transport: createSupabaseTransport(supabaseSyncBackend(client)),
      // Same streak rules as live study, so replays match the streak screens.
      streakConfig: STREAK_CONFIG,
    }),
    auth: createAuthService(client),
    session: client.auth,
    redirectUrl: Linking.createURL(AUTH_REDIRECT_PATH),
  };
}

/** Props for {@link SyncProvider}. */
export interface SyncProviderProps {
  children: ReactNode;
  /** Defaults to the `EXPO_PUBLIC_SUPABASE_*` environment. */
  config?: SupabaseConfig | null;
}

/**
 * Accounts and sync for the app. Place inside `DatabaseProvider`. Without a
 * Supabase config it renders its children with sync switched off.
 */
export function SyncProvider({ children, config }: SyncProviderProps): ReactNode {
  const db = useDatabase();
  const [services] = useState(() =>
    createSyncServices(db, config === undefined ? readSupabaseConfig() : config),
  );
  return <SyncServicesProvider services={services}>{children}</SyncServicesProvider>;
}

/** Props for {@link SyncServicesProvider}. */
export interface SyncServicesProviderProps {
  children: ReactNode;
  services: SyncServices | null;
}

/**
 * Runs sync with the given services: on start, whenever the app comes to the
 * foreground, after sign-in, and on request. Also completes magic-link
 * sign-ins from deep links. Tests pass fake services here.
 */
export function SyncServicesProvider({ children, services }: SyncServicesProviderProps): ReactNode {
  const [status, setStatus] = useState<SyncStatus | null>(services?.engine.status ?? null);
  const [user, setUser] = useState<AccountUser | null>(null);

  useEffect(() => {
    if (services === null) return;
    const { engine, auth, session } = services;
    let active = true;

    const unsubscribeStatus = engine.subscribe(setStatus);
    const unsubscribeAuth = auth.onChange((next, event) => {
      setUser(next);
      if (event === 'SIGNED_IN') engine.requestSync('sign_in');
    });
    void auth.getUser().then((u) => {
      if (active) setUser(u);
    });

    const onUrl = (url: string | null) => {
      if (url !== null) void auth.completeFromUrl(url).catch(() => undefined);
    };
    void Linking.getInitialURL().then(onUrl);
    const linkSubscription = Linking.addEventListener('url', ({ url }) => {
      onUrl(url);
    });

    session?.startAutoRefresh();
    engine.requestSync('foreground');
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        session?.startAutoRefresh();
        engine.requestSync('foreground');
      } else {
        session?.stopAutoRefresh();
      }
    });

    return () => {
      active = false;
      unsubscribeStatus();
      unsubscribeAuth();
      linkSubscription.remove();
      appState.remove();
      session?.stopAutoRefresh();
      // The engine outlives this effect (it may re-run in development); it holds no resources.
    };
  }, [services]);

  const value = useMemo<SyncContextValue>(() => {
    if (services === null) return DISABLED;
    return {
      enabled: true,
      status,
      user,
      auth: services.auth,
      redirectUrl: services.redirectUrl ?? null,
      syncNow: () => services.engine.sync('manual'),
      notifySessionEnded: () => {
        services.engine.requestSync('session_ended');
      },
    };
  }, [services, status, user]);

  return <SyncContext value={value}>{children}</SyncContext>;
}

/** Account and sync state. Outside a provider, sync reads as switched off. */
export function useSync(): SyncContextValue {
  return useContext(SyncContext);
}
