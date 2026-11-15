/**
 * `@italia/api-contract`: zod schemas for data exchanged between the app and
 * the sync backend. Both sides validate with these schemas.
 *
 * @packageDocumentation
 */

export { RatingSchema, ReviewLogDtoSchema, type ReviewLogDto } from './review-log';
export {
  CardFlagDtoSchema,
  ErrorRecordDtoSchema,
  JsonValueSchema,
  nextCursor,
  PullRequestSchema,
  PullResponseSchema,
  PushRequestSchema,
  SettingDtoSchema,
  StudySessionDtoSchema,
  SYNC_BATCH_MAX,
  SYNC_ROW_SCHEMAS,
  SYNC_TABLES,
  SyncCursorSchema,
  SyncTableSchema,
  type CardFlagDto,
  type ErrorRecordDto,
  type JsonValue,
  type PullRequest,
  type PullResponse,
  type PullResponseFor,
  type PushRequest,
  type PushRequestFor,
  type SettingDto,
  type StudySessionDto,
  type SyncCursor,
  type SyncRowMap,
  type SyncTable,
} from './sync';
export {
  fromServerRow,
  SYNC_TABLE_SPECS,
  toServerRow,
  type ServerRowInput,
  type SyncTableSpec,
} from './server-rows';
