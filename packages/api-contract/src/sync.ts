import { z } from 'zod';

import { ReviewLogDtoSchema } from './review-log';

/** Most rows in one push or pull batch. */
export const SYNC_BATCH_MAX = 500;

/** Tables that sync, named as on the server. Card FSRS state and the streak are derived on each device. */
export const SYNC_TABLES = [
  'review_log',
  'card_flag',
  'setting',
  'study_session',
  'error_record',
] as const;

/** A synced table. */
export type SyncTable = (typeof SYNC_TABLES)[number];

/** Schema of {@link SyncTable}. */
export const SyncTableSchema = z.enum(SYNC_TABLES);

const isoTime = z.iso.datetime({ offset: true });
const deviceId = z.string().min(1).max(100);
const cardId = z.string().min(1).max(200);

/**
 * A pull cursor: the largest `server_seq` the device has merged for one
 * table, or 0 before the first pull. Server sequences are positive.
 */
export const SyncCursorSchema = z.number().int().nonnegative();

/** A pull cursor. */
export type SyncCursor = z.infer<typeof SyncCursorSchema>;

/**
 * A per-card flag, last-writer-wins by `(updatedAt, deviceId)`. Cards
 * themselves are not synced: every device derives the same card id from the
 * item it practises, and rebuilds its FSRS state from the review logs.
 */
export const CardFlagDtoSchema = z
  .object({
    cardId,
    /** Suspended cards are never scheduled. */
    suspended: z.boolean(),
    /** When the flag last changed, ISO 8601 with offset. */
    updatedAt: isoTime,
    /** Device that made the change; breaks ties on `updatedAt`. */
    deviceId,
  })
  .strict();

/** A card flag in transit. */
export type CardFlagDto = z.infer<typeof CardFlagDtoSchema>;

/** Any JSON value. */
export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().refine(Number.isFinite, 'must be finite'),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);

/** A JSON value. */
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * One setting, last-writer-wins per key by `(updatedAt, deviceId)`. The value
 * is validated per key by the app; unknown keys are ignored on merge so a
 * newer app version can add settings.
 */
export const SettingDtoSchema = z
  .object({
    key: z.string().min(1).max(100),
    value: JsonValueSchema,
    updatedAt: isoTime,
    deviceId,
  })
  .strict();

/** A setting in transit. */
export type SettingDto = z.infer<typeof SettingDtoSchema>;

/** A finished study session. Append-only: a session syncs once, after it ends. */
export const StudySessionDtoSchema = z
  .object({
    id: z.uuid(),
    startedAt: isoTime,
    endedAt: isoTime,
    minutesActive: z.number().nonnegative().max(1440),
    /** Activity kinds completed, in order. */
    activities: z.array(z.string().max(100)).max(200),
  })
  .strict()
  .refine((s) => Date.parse(s.endedAt) >= Date.parse(s.startedAt), {
    message: 'endedAt must not be before startedAt',
    path: ['endedAt'],
  });

/** A study session in transit. */
export type StudySessionDto = z.infer<typeof StudySessionDtoSchema>;

/** A learner error. Append-only. */
export const ErrorRecordDtoSchema = z
  .object({
    id: z.uuid(),
    /** Error taxonomy key, e.g. "agreement.gender". */
    category: z.string().min(1).max(200),
    example: z.string().max(4000),
    source: z.enum(['conversation', 'review']),
    cardId: cardId.nullable(),
    createdAt: isoTime,
  })
  .strict();

/** An error record in transit. */
export type ErrorRecordDto = z.infer<typeof ErrorRecordDtoSchema>;

/** The row schema of each synced table. */
export const SYNC_ROW_SCHEMAS = {
  review_log: ReviewLogDtoSchema,
  card_flag: CardFlagDtoSchema,
  setting: SettingDtoSchema,
  study_session: StudySessionDtoSchema,
  error_record: ErrorRecordDtoSchema,
} as const;

/** The row type of each synced table. */
export interface SyncRowMap {
  review_log: z.infer<typeof ReviewLogDtoSchema>;
  card_flag: CardFlagDto;
  setting: SettingDto;
  study_session: StudySessionDto;
  error_record: ErrorRecordDto;
}

const batch = <T extends z.ZodType>(row: T) => z.array(row).min(1).max(SYNC_BATCH_MAX);

const pushOf = <K extends SyncTable>(table: K) =>
  z.object({ table: z.literal(table), rows: batch(SYNC_ROW_SCHEMAS[table]) }).strict();

/**
 * A batch of rows a device pushes to one table. Pushes are idempotent: the
 * server ignores rows of append-only tables it already has (by id) and keeps
 * the newer side of last-writer-wins rows, so a batch can be resent safely.
 */
export const PushRequestSchema = z.discriminatedUnion('table', [
  pushOf('review_log'),
  pushOf('card_flag'),
  pushOf('setting'),
  pushOf('study_session'),
  pushOf('error_record'),
]);

/** A push batch. */
export type PushRequest = z.infer<typeof PushRequestSchema>;

/** A push batch for table `K`. */
export type PushRequestFor<K extends SyncTable> = Extract<PushRequest, { table: K }>;

/** Ask for rows of one table with `server_seq` greater than `after`, oldest first. */
export const PullRequestSchema = z
  .object({
    table: SyncTableSchema,
    after: SyncCursorSchema,
    limit: z.number().int().min(1).max(SYNC_BATCH_MAX),
  })
  .strict();

/** A pull request. */
export type PullRequest = z.infer<typeof PullRequestSchema>;

const pulledOf = <K extends SyncTable>(table: K) =>
  z
    .object({
      table: z.literal(table),
      rows: z.array(
        z.object({ serverSeq: z.number().int().positive(), row: SYNC_ROW_SCHEMAS[table] }).strict(),
      ),
      /** True when more rows may follow; pull again from `cursor`. */
      hasMore: z.boolean(),
    })
    .strict()
    .refine(
      (r) => r.rows.every((x, i) => i === 0 || x.serverSeq > (r.rows[i - 1]?.serverSeq ?? 0)),
      { message: 'rows must be in increasing serverSeq order', path: ['rows'] },
    );

/**
 * One page of pulled rows, in increasing `serverSeq` order. The device merges
 * them and stores the last `serverSeq` as its new cursor for the table.
 */
export const PullResponseSchema = z.union([
  pulledOf('review_log'),
  pulledOf('card_flag'),
  pulledOf('setting'),
  pulledOf('study_session'),
  pulledOf('error_record'),
]);

/** A page of pulled rows. */
export type PullResponse = z.infer<typeof PullResponseSchema>;

/** A page of pulled rows of table `K`. */
export type PullResponseFor<K extends SyncTable> = Extract<PullResponse, { table: K }>;

/** The cursor after a pulled page: its last `serverSeq`, or `previous` when empty. */
export function nextCursor(response: PullResponse, previous: SyncCursor): SyncCursor {
  return response.rows.at(-1)?.serverSeq ?? previous;
}
