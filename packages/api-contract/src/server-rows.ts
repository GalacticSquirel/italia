import { z } from 'zod';

import { JsonValueSchema, SYNC_ROW_SCHEMAS, type SyncRowMap, type SyncTable } from './sync';

/**
 * How the sync tables look in Postgres (`supabase/migrations`), and the
 * mapping between those rows and the DTOs. Column names are snake_case;
 * `user_id` is set from the signed-in user and `server_seq` by the server.
 */

/**
 * The Postgres schema that holds the sync tables. They are kept out of
 * `public` so the app can share a (self-hosted) database with other projects;
 * the API must expose this schema and the client must select it.
 */
export const SYNC_DB_SCHEMA = 'italia';

const serverSeq = z.coerce.number().int().positive();
const time = z.string().min(1);

const SERVER_ROW_SCHEMAS = {
  review_log: z.object({
    id: z.string(),
    card_id: z.string(),
    rating: z.string(),
    answer: z.string().nullable(),
    latency_ms: z.number(),
    reviewed_at: time,
    device_id: z.string(),
    server_seq: serverSeq,
  }),
  card_flag: z.object({
    card_id: z.string(),
    suspended: z.boolean(),
    updated_at: time,
    device_id: z.string(),
    server_seq: serverSeq,
  }),
  setting: z.object({
    key: z.string(),
    value: JsonValueSchema,
    updated_at: time,
    device_id: z.string(),
    server_seq: serverSeq,
  }),
  study_session: z.object({
    id: z.string(),
    started_at: time,
    ended_at: time,
    minutes_active: z.number(),
    activities: z.array(z.string()),
    server_seq: serverSeq,
  }),
  error_record: z.object({
    id: z.string(),
    category: z.string(),
    example: z.string(),
    source: z.string(),
    card_id: z.string().nullable(),
    created_at: time,
    server_seq: serverSeq,
  }),
  learner_sentence: z.object({
    id: z.number(),
    it: z.string(),
    original: z.string(),
    error_tags: z.array(z.string()),
    grammar_ids: z.array(z.number()),
    source: z.string(),
    created_at: time,
    server_seq: serverSeq,
  }),
} as const;

/** A Postgres row of a sync table, as written by a device (no `server_seq`). */
export type ServerRowInput = Record<string, unknown> & { user_id: string };

/** Static facts about each sync table on the server. */
export interface SyncTableSpec {
  /** Primary key columns, used as the upsert conflict target. */
  conflictColumns: readonly string[];
  /**
   * Append-only tables are pushed with ON CONFLICT DO NOTHING; the others
   * with ON CONFLICT DO UPDATE, which the server's last-writer-wins trigger
   * guards.
   */
  appendOnly: boolean;
  /** Columns a pull selects. */
  selectColumns: readonly string[];
}

const columnsOf = (table: SyncTable): string[] => Object.keys(SERVER_ROW_SCHEMAS[table].shape);

/** Server facts for every sync table. */
export const SYNC_TABLE_SPECS: Readonly<Record<SyncTable, SyncTableSpec>> = {
  review_log: {
    conflictColumns: ['user_id', 'id'],
    appendOnly: true,
    selectColumns: columnsOf('review_log'),
  },
  card_flag: {
    conflictColumns: ['user_id', 'card_id'],
    appendOnly: false,
    selectColumns: columnsOf('card_flag'),
  },
  setting: {
    conflictColumns: ['user_id', 'key'],
    appendOnly: false,
    selectColumns: columnsOf('setting'),
  },
  study_session: {
    conflictColumns: ['user_id', 'id'],
    appendOnly: true,
    selectColumns: columnsOf('study_session'),
  },
  error_record: {
    conflictColumns: ['user_id', 'id'],
    appendOnly: true,
    selectColumns: columnsOf('error_record'),
  },
  learner_sentence: {
    conflictColumns: ['user_id', 'id'],
    appendOnly: true,
    selectColumns: columnsOf('learner_sentence'),
  },
};

interface Mapper<K extends SyncTable> {
  toServer: (row: SyncRowMap[K]) => Record<string, unknown>;
  fromServer: (row: z.infer<(typeof SERVER_ROW_SCHEMAS)[K]>) => unknown;
}

const MAPPERS: { [K in SyncTable]: Mapper<K> } = {
  review_log: {
    toServer: (r) => ({
      id: r.id,
      card_id: r.cardId,
      rating: r.rating,
      answer: r.answer,
      latency_ms: r.latencyMs,
      reviewed_at: r.reviewedAt,
      device_id: r.deviceId,
    }),
    fromServer: (r) => ({
      id: r.id,
      cardId: r.card_id,
      rating: r.rating,
      answer: r.answer,
      latencyMs: r.latency_ms,
      reviewedAt: r.reviewed_at,
      deviceId: r.device_id,
    }),
  },
  card_flag: {
    toServer: (r) => ({
      card_id: r.cardId,
      suspended: r.suspended,
      updated_at: r.updatedAt,
      device_id: r.deviceId,
    }),
    fromServer: (r) => ({
      cardId: r.card_id,
      suspended: r.suspended,
      updatedAt: r.updated_at,
      deviceId: r.device_id,
    }),
  },
  setting: {
    toServer: (r) => ({
      key: r.key,
      value: r.value,
      updated_at: r.updatedAt,
      device_id: r.deviceId,
    }),
    fromServer: (r) => ({
      key: r.key,
      value: r.value,
      updatedAt: r.updated_at,
      deviceId: r.device_id,
    }),
  },
  study_session: {
    toServer: (r) => ({
      id: r.id,
      started_at: r.startedAt,
      ended_at: r.endedAt,
      minutes_active: r.minutesActive,
      activities: r.activities,
    }),
    fromServer: (r) => ({
      id: r.id,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      minutesActive: r.minutes_active,
      activities: r.activities,
    }),
  },
  error_record: {
    toServer: (r) => ({
      id: r.id,
      category: r.category,
      example: r.example,
      source: r.source,
      card_id: r.cardId,
      created_at: r.createdAt,
    }),
    fromServer: (r) => ({
      id: r.id,
      category: r.category,
      example: r.example,
      source: r.source,
      cardId: r.card_id,
      createdAt: r.created_at,
    }),
  },
  learner_sentence: {
    toServer: (r) => ({
      id: r.id,
      it: r.it,
      original: r.original,
      error_tags: r.errorTags,
      grammar_ids: r.grammarIds,
      source: r.source,
      created_at: r.createdAt,
    }),
    fromServer: (r) => ({
      id: r.id,
      it: r.it,
      original: r.original,
      errorTags: r.error_tags,
      grammarIds: r.grammar_ids,
      source: r.source,
      createdAt: r.created_at,
    }),
  },
};

/** The Postgres row for a DTO of `table`, owned by `userId`. */
export function toServerRow<K extends SyncTable>(
  table: K,
  row: SyncRowMap[K],
  userId: string,
): ServerRowInput {
  return { user_id: userId, ...MAPPERS[table].toServer(row) };
}

/**
 * Parse a Postgres row of `table` (as PostgREST returns it) into its DTO and
 * `serverSeq`, validated with the DTO schema.
 *
 * @throws ZodError when the row does not match
 */
export function fromServerRow<K extends SyncTable>(
  table: K,
  raw: unknown,
): { serverSeq: number; row: SyncRowMap[K] } {
  const parsed = SERVER_ROW_SCHEMAS[table].parse(raw) as z.infer<(typeof SERVER_ROW_SCHEMAS)[K]>;
  const dto: unknown = MAPPERS[table].fromServer(parsed);
  return {
    serverSeq: parsed.server_seq,
    row: SYNC_ROW_SCHEMAS[table].parse(dto) as SyncRowMap[K],
  };
}
