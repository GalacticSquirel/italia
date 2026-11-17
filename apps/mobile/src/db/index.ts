export { DATABASE_NAME, openDatabase, type Database, type DatabaseHandle } from './client';
export {
  DatabaseProvider,
  useDatabase,
  useRepositories,
  type DatabaseProviderProps,
} from './DatabaseProvider';
export * as schema from './schema';
export type { AppDatabase, AppSchema } from './types';
