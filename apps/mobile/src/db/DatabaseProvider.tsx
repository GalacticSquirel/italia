import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Screen, Text, useTheme } from '@/ui';

import { openDatabase, type Database } from './client';
import migrations from '../../drizzle/migrations';

const DatabaseContext = createContext<Database | null>(null);

/**
 * Opens the local database and applies pending migrations before rendering
 * its children. Shows a loading state while migrating and an error state if
 * a migration fails.
 */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [{ db }] = useState(() => openDatabase());
  const { success, error } = useMigrations(db, migrations);
  const { colors } = useTheme();

  if (error) {
    return (
      <Screen title="Something went wrong" edges={['top', 'bottom', 'left', 'right']}>
        <Text accessibilityRole="alert">Italia could not prepare its database on this device.</Text>
        <Text color="textMuted" selectable>
          {error.message}
        </Text>
      </Screen>
    );
  }

  if (!success) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator
          size="large"
          color={colors.primary}
          accessibilityLabel="Preparing your data"
        />
      </View>
    );
  }

  return <DatabaseContext value={db}>{children}</DatabaseContext>;
}

/** The migrated app database. Must be used inside {@link DatabaseProvider}. */
export function useDatabase(): Database {
  const db = useContext(DatabaseContext);
  if (!db) {
    throw new Error('useDatabase must be used inside DatabaseProvider');
  }
  return db;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
