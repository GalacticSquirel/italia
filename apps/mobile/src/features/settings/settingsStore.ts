import { create } from 'zustand';

import { defaultSettings, type Repositories, type SettingKey, type Settings } from '@/data';

/** The learner's settings, mirrored in memory so every screen (and the theme) sees changes at once. */
export interface SettingsStoreState {
  settings: Settings;
  /** Load settings from the database. */
  hydrate: (repos: Repositories) => void;
  /**
   * Save one setting and update the mirror.
   *
   * @throws ZodError when the value is invalid for the key
   */
  update: <K extends SettingKey>(repos: Repositories, key: K, value: Settings[K]) => void;
}

/** Global settings store. Hydrated once the database is ready. */
export const useSettingsStore = create<SettingsStoreState>()((set) => ({
  settings: defaultSettings(),
  hydrate(repos) {
    set({ settings: repos.settings.getAll() });
  },
  update(repos, key, value) {
    repos.settings.set(key, value);
    set({ settings: repos.settings.getAll() });
  },
}));
