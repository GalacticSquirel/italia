import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { DEFAULT_DESIRED_RETENTION } from '@italia/core';

import { settings } from '@/db/schema';
import type { AppDatabase } from '@/db/types';

/**
 * Every setting with its validation rule and default. A stored value that no
 * longer validates (for example after a rule tightens) reads as the default.
 */
export const SETTINGS_SCHEMA = {
  /** New items introduced per day. */
  dailyNewLimit: z.number().int().min(0).max(200).default(20),
  /** Daily study time budget in minutes; the session builder throttles new items to fit. */
  minutesBudget: z.number().int().min(5).max(240).default(60),
  /** FSRS desired retention. */
  desiredRetention: z.number().min(0.7).max(0.99).default(DEFAULT_DESIRED_RETENTION),
  /** Preferred TTS voice id, or null for the default voice. */
  voiceId: z.string().min(1).nullable().default(null),
  /** TTS speaking rate multiplier. */
  speechRate: z.number().min(0.5).max(2).default(1),
  /** Play prompt audio automatically. */
  autoplayAudio: z.boolean().default(true),
  /** Prefer spoken answers over typed ones where a card allows both. */
  preferSpokenAnswers: z.boolean().default(false),
  /** Accept answers that differ only in accents (they are still flagged). */
  accentInsensitive: z.boolean().default(true),
  /** Colour scheme. */
  theme: z.enum(['system', 'light', 'dark']).default('system'),
  /** Opt-in crash reports. */
  crashReportsOptIn: z.boolean().default(false),
} as const;

/** A settings key. */
export type SettingKey = keyof typeof SETTINGS_SCHEMA;

/** All settings with their value types. */
export type Settings = { [K in SettingKey]: z.output<(typeof SETTINGS_SCHEMA)[K]> };

/** All setting keys. */
export const SETTING_KEYS = Object.keys(SETTINGS_SCHEMA) as SettingKey[];

/** Whether `key` names a known setting. */
export function isSettingKey(key: string): key is SettingKey {
  return Object.hasOwn(SETTINGS_SCHEMA, key);
}

/** Parse a stored value for `key`, falling back to the default when invalid or missing. */
export function parseSetting<K extends SettingKey>(key: K, value: unknown): Settings[K] {
  const schema: z.ZodType<Settings[K]> = SETTINGS_SCHEMA[key] as unknown as z.ZodType<Settings[K]>;
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  return schema.parse(undefined);
}

/** The default value of every setting. */
export function defaultSettings(): Settings {
  const out: Partial<Record<SettingKey, unknown>> = {};
  for (const key of SETTING_KEYS) out[key] = parseSetting(key, undefined);
  return out as Settings;
}

/** Typed key/value settings, validated with zod, last-writer-wins by `updatedAt`. */
export interface SettingsRepo {
  /** The current value of `key` (its default when unset). */
  get<K extends SettingKey>(key: K): Settings[K];
  /** All settings, with defaults for unset keys. */
  getAll(): Settings;
  /**
   * Set `key` to `value` at time `now`.
   *
   * @throws ZodError when `value` is invalid for `key`
   */
  set<K extends SettingKey>(key: K, value: Settings[K], now?: Date): void;
  /**
   * Remove a stored value so `key` reads as its default again. This is local
   * only: to change the value on every device, `set` the default instead.
   */
  reset(key: SettingKey): void;
}

/** Create a {@link SettingsRepo}. */
export function createSettingsRepo(db: AppDatabase): SettingsRepo {
  return {
    get(key) {
      const row = db
        .select({ value: settings.value })
        .from(settings)
        .where(eq(settings.key, key))
        .get();
      return parseSetting(key, row?.value);
    },
    getAll() {
      const stored = new Map(
        db
          .select({ key: settings.key, value: settings.value })
          .from(settings)
          .all()
          .map((r) => [r.key, r.value] as const),
      );
      const out: Partial<Record<SettingKey, unknown>> = {};
      for (const key of SETTING_KEYS) out[key] = parseSetting(key, stored.get(key));
      return out as Settings;
    },
    set(key, value, now = new Date()) {
      const valid = SETTINGS_SCHEMA[key].parse(value);
      // deviceId null = written on this device; syncedAt null = not yet pushed.
      const row = { value: valid, updatedAt: now, deviceId: null, syncedAt: null };
      db.insert(settings)
        .values({ key, ...row })
        .onConflictDoUpdate({ target: settings.key, set: row })
        .run();
    },
    reset(key) {
      db.delete(settings).where(eq(settings.key, key)).run();
    },
  };
}
