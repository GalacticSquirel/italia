import { useCallback } from 'react';

import type { SettingKey, Settings } from '@/data';
import { useRepositories } from '@/db';

import { useSettingsStore } from './settingsStore';

/** The current settings and a setter that persists them. */
export function useSettings(): {
  settings: Settings;
  setSetting: <K extends SettingKey>(key: K, value: Settings[K]) => void;
} {
  const repos = useRepositories();
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const setSetting = useCallback(
    <K extends SettingKey>(key: K, value: Settings[K]) => {
      update(repos, key, value);
    },
    [repos, update],
  );
  return { settings, setSetting };
}
