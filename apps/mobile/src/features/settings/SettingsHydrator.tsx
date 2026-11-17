import { useEffect } from 'react';

import { useRepositories } from '@/db';
import { useSync } from '@/sync';

import { useSettingsStore } from './settingsStore';

/**
 * Loads the stored settings into the settings store once the database is
 * ready, and again after each sync (which may bring settings from other devices).
 */
export function SettingsHydrator() {
  const repos = useRepositories();
  const hydrate = useSettingsStore((s) => s.hydrate);
  const lastSyncAt = useSync().status?.lastSuccessAt?.getTime() ?? null;
  useEffect(() => {
    hydrate(repos);
  }, [hydrate, repos, lastSyncAt]);
  return null;
}
