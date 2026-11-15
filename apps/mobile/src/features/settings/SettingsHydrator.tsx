import { useEffect } from 'react';

import { useRepositories } from '@/db';

import { useSettingsStore } from './settingsStore';

/** Loads the stored settings into the settings store once the database is ready. */
export function SettingsHydrator() {
  const repos = useRepositories();
  const hydrate = useSettingsStore((s) => s.hydrate);
  useEffect(() => {
    hydrate(repos);
  }, [hydrate, repos]);
  return null;
}
