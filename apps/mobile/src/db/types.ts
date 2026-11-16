import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type * as schema from './schema';

/** The app's full Drizzle schema. */
export type AppSchema = typeof schema;

/**
 * Any synchronous Drizzle SQLite database (or open transaction) over the app
 * schema. The app passes its expo-sqlite database; tests pass a
 * better-sqlite3 one built from the same schema and migrations. Repositories
 * accept this type so they work with either, and inside transactions.
 */
export type AppDatabase = BaseSQLiteDatabase<'sync', unknown, AppSchema>;
