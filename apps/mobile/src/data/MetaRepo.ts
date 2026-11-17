import { eq } from 'drizzle-orm';

import { appMeta } from '@/db/schema';
import type { AppDatabase } from '@/db/types';

import type { IdGenerator } from './ids';

/** Known device-local metadata keys. */
export const META_KEYS = {
  /** Version of the content seed last imported. */
  seedVersion: 'seed.version',
  /** When that seed was generated (ISO 8601). */
  seedGeneratedAt: 'seed.generatedAt',
  /** Fingerprint (asset content hash) of the bundled seed last checked, see `ensureSeed`. */
  seedFingerprint: 'seed.fingerprint',
  /** This installation's device id, recorded on every review. */
  deviceId: 'device.id',
  /** Account whose data this device last synced; a different account resets the sync state. */
  syncUserId: 'sync.userId',
  /** When the last sync completed (ISO 8601). */
  syncLastSuccessAt: 'sync.lastSuccessAt',
  /** Pull cursors: the largest server_seq merged, per server table. */
  syncCursorReviewLog: 'sync.cursor.review_log',
  syncCursorCardFlag: 'sync.cursor.card_flag',
  syncCursorSetting: 'sync.cursor.setting',
  syncCursorStudySession: 'sync.cursor.study_session',
  syncCursorErrorRecord: 'sync.cursor.error_record',
} as const;

/** A metadata key. */
export type MetaKey = (typeof META_KEYS)[keyof typeof META_KEYS];

/** Device-local metadata. Never synced and never included in backups. */
export interface MetaRepo {
  /** The value for `key`, or null. */
  get(key: MetaKey): string | null;
  /** Store `value` for `key`. */
  set(key: MetaKey, value: string, now?: Date): void;
  /** Remove `key`. */
  remove(key: MetaKey): void;
  /** This device's id, created on first use. */
  getOrCreateDeviceId(): string;
}

/** Create a {@link MetaRepo}. */
export function createMetaRepo(db: AppDatabase, newId: IdGenerator): MetaRepo {
  const get = (key: MetaKey): string | null =>
    db.select({ value: appMeta.value }).from(appMeta).where(eq(appMeta.key, key)).get()?.value ??
    null;
  const set = (key: MetaKey, value: string, now: Date = new Date()): void => {
    db.insert(appMeta)
      .values({ key, value, updatedAt: now })
      .onConflictDoUpdate({ target: appMeta.key, set: { value, updatedAt: now } })
      .run();
  };
  return {
    get,
    set,
    remove(key) {
      db.delete(appMeta).where(eq(appMeta.key, key)).run();
    },
    getOrCreateDeviceId() {
      const existing = get(META_KEYS.deviceId);
      if (existing !== null) return existing;
      const id = newId();
      db.insert(appMeta)
        .values({ key: META_KEYS.deviceId, value: id, updatedAt: new Date() })
        .onConflictDoNothing()
        .run();
      return get(META_KEYS.deviceId) ?? id;
    },
  };
}
