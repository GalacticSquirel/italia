export { DATABASE_NAME, openDatabase, type Database, type DatabaseHandle } from './client';
export {
  DatabaseProvider,
  RepositoryProvider,
  useDatabase,
  useRepositories,
  type DatabaseProviderProps,
  type RepositoryProviderProps,
} from './DatabaseProvider';
export * as schema from './schema';
export type { AppDatabase, AppSchema } from './types';
