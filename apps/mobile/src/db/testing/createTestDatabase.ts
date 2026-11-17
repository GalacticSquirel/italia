/**
 * Test-only helper: a real in-memory SQLite database with the app schema and
 * the committed migrations applied. Never import this from app code; it uses
 * the better-sqlite3 dev dependency, which does not run on a phone.
 */
import path from 'node:path';

import Sqlite from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import * as schema from '../schema';
import type { AppDatabase } from '../types';

/** Folder holding the committed Drizzle migrations. */
export const MIGRATIONS_FOLDER = path.resolve(__dirname, '../../../drizzle');

/** A migrated test database and its raw connection. */
export interface TestDatabase {
  db: AppDatabase;
  /** Raw connection, for asserting on SQL directly (query plans, triggers). */
  sqlite: Sqlite.Database;
  close: () => void;
}

/** Open a fresh in-memory database with all migrations applied. */
export function createTestDatabase(): TestDatabase {
  const sqlite = new Sqlite(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return {
    db,
    sqlite,
    close: () => {
      sqlite.close();
    },
  };
}

/** A deterministic id generator for tests: `prefix-1`, `prefix-2`, ... */
export function sequentialIds(prefix = 'id'): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `${prefix}-${String(n).padStart(6, '0')}`;
  };
}
