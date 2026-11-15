import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import * as schema from './schema';

/** File name of the app database in the app's private documents directory. */
export const DATABASE_NAME = 'italia.db';

export type Database = ExpoSQLiteDatabase<typeof schema>;

export interface DatabaseHandle {
  sqlite: SQLiteDatabase;
  db: Database;
}

/** Open (creating if needed) the app database with foreign keys and WAL enabled. */
export function openDatabase(name: string = DATABASE_NAME): DatabaseHandle {
  const sqlite = openDatabaseSync(name);
  sqlite.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  return { sqlite, db: drizzle(sqlite, { schema }) };
}
