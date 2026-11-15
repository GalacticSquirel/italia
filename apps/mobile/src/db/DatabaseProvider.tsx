import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { createRepositories, type Repositories } from '@/data/repositories';
import { importSeed, type SeedImportProgress } from '@/data/seed/importSeed';
import { bundledSeedLoader, type SeedLoader } from '@/data/seed/seedLoader';
import { Screen, Text, useTheme } from '@/ui';

import { openDatabase } from './client';
import type { AppDatabase } from './types';
import migrations from '../../drizzle/migrations';

interface DatabaseContextValue {
  db: AppDatabase;
  repos: Repositories;
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

type SeedStatus =
  | { kind: 'pending'; progress: SeedImportProgress | null }
  | { kind: 'ready' }
  | { kind: 'failed'; error: Error };

/** Props for {@link DatabaseProvider}. */
export interface DatabaseProviderProps {
  children: ReactNode;
  /** Where the content seed comes from; defaults to the seed bundled in the app. */
  seedLoader?: SeedLoader;
}

/**
 * Opens the local database, applies pending migrations, then imports the
 * content seed if it is new, before rendering its children. Shows a loading
 * state (with seed progress) while preparing and an error state on failure.
 */
export function DatabaseProvider({
  children,
  seedLoader = bundledSeedLoader,
}: DatabaseProviderProps): ReactNode {
  const [{ db }] = useState(() => openDatabase());
  const repos = useMemo(() => createRepositories(db), [db]);
  const { success, error } = useMigrations(db, migrations);
  const [seed, setSeed] = useState<SeedStatus>({ kind: 'pending', progress: null });
  const { colors } = useTheme();

  useEffect(() => {
    if (!success) return;
    const run = { cancelled: false };
    void (async () => {
      try {
        const raw = await seedLoader();
        await importSeed(db, raw, {
          onProgress: (progress) => {
            if (!run.cancelled) setSeed({ kind: 'pending', progress });
          },
        });
        if (!run.cancelled) setSeed({ kind: 'ready' });
      } catch (e) {
        if (!run.cancelled)
          setSeed({ kind: 'failed', error: e instanceof Error ? e : Error(String(e)) });
      }
    })();
    return () => {
      run.cancelled = true;
    };
  }, [db, success, seedLoader]);

  const value = useMemo(() => ({ db, repos }), [db, repos]);
  const failure = error ?? (seed.kind === 'failed' ? seed.error : null);

  if (failure) {
    return (
      <Screen title="Something went wrong" edges={['top', 'bottom', 'left', 'right']}>
        <Text accessibilityRole="alert">Italia could not prepare its database on this device.</Text>
        <Text color="textMuted" selectable>
          {failure.message}
        </Text>
      </Screen>
    );
  }

  if (!success || seed.kind !== 'ready') {
    const progress = seed.kind === 'pending' ? seed.progress : null;
    const label =
      progress && progress.total > 0
        ? `Preparing your data, ${String(Math.round((progress.done / progress.total) * 100))} percent`
        : 'Preparing your data';
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} accessibilityLabel={label} />
      </View>
    );
  }

  return <DatabaseContext value={value}>{children}</DatabaseContext>;
}

/** Props for {@link RepositoryProvider}. */
export interface RepositoryProviderProps {
  db: AppDatabase;
  repos: Repositories;
  children: ReactNode;
}

/**
 * Provides an already prepared database and its repositories to
 * {@link useDatabase} and {@link useRepositories}. The app uses
 * {@link DatabaseProvider}; tests use this with an in-memory database.
 */
export function RepositoryProvider({ db, repos, children }: RepositoryProviderProps): ReactNode {
  const value = useMemo(() => ({ db, repos }), [db, repos]);
  return <DatabaseContext value={value}>{children}</DatabaseContext>;
}

function useDatabaseContext(): DatabaseContextValue {
  const value = useContext(DatabaseContext);
  if (!value) {
    throw new Error('useDatabase must be used inside DatabaseProvider');
  }
  return value;
}

/** The migrated, seeded app database. Must be used inside {@link DatabaseProvider}. */
export function useDatabase(): AppDatabase {
  return useDatabaseContext().db;
}

/** All repositories over the app database. Must be used inside {@link DatabaseProvider}. */
export function useRepositories(): Repositories {
  return useDatabaseContext().repos;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
