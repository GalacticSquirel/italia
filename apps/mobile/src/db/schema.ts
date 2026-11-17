/**
 * Local SQLite schema (plan section 4). The same tables are mirrored in
 * Postgres for sync in Phase 2.
 *
 * Conventions:
 * - Content tables (`lemma`, `sentence`, `grammar_point`) use integer ids
 *   assigned by the content pipeline, so seed updates keep ids stable.
 * - Learner tables use text UUIDs generated on the device, so rows from
 *   several devices can be merged without collisions. The exception is
 *   `card`, whose id is derived from `(kind, target_id, prompt_mode)` (see
 *   `cardIdFor` in `@/data`) so every device names the same card alike.
 * - Times are stored as integer milliseconds since the Unix epoch.
 * - `review_log` is append-only: rows are inserted, never updated or deleted.
 */
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

import { CARD_KINDS, CARD_STATES, PROMPT_MODES, RATINGS } from '@italia/core';

const timestamp = (name: string) => integer(name, { mode: 'timestamp_ms' });
const createdAt = () =>
  timestamp('created_at')
    .notNull()
    .$defaultFn(() => new Date());

/** A word token in a sentence: `[start, end, ...lemmaIds]`, see `sentence.tokens`. */
export type SentenceToken = [number, number, ...number[]];

const tuple = <T extends string>(values: readonly T[]) => values as [T, ...T[]];

/** CEFR bands used to level content. */
export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

/** Where an error record came from. */
export const ERROR_SOURCES = ['conversation', 'review'] as const;

/** Where a story came from. */
export const STORY_SOURCES = ['bundled', 'generated'] as const;

// ---------------------------------------------------------------------------
// Content (seeded from packages/content)
// ---------------------------------------------------------------------------

export const lemma = sqliteTable(
  'lemma',
  {
    id: integer('id').primaryKey(),
    lemma: text('lemma').notNull(),
    /** Universal POS tag, e.g. NOUN, VERB. */
    pos: text('pos').notNull(),
    /** 1 = most frequent. */
    freqRank: integer('freq_rank').notNull(),
    glossEn: text('gloss_en').notNull(),
    audioRef: text('audio_ref'),
  },
  (t) => [
    uniqueIndex('lemma_lemma_pos_unique').on(t.lemma, t.pos),
    uniqueIndex('lemma_freq_rank_unique').on(t.freqRank),
  ],
);

export const sentence = sqliteTable(
  'sentence',
  {
    id: integer('id').primaryKey(),
    it: text('it').notNull(),
    en: text('en').notNull(),
    lemmaIds: text('lemma_ids', { mode: 'json' }).$type<number[]>().notNull(),
    grammarIds: text('grammar_ids', { mode: 'json' }).$type<number[]>().notNull(),
    /**
     * Word tokens of `it` as `[start, end, ...lemmaIds]` (UTF-16 offsets, end
     * exclusive), or null when the seed has none. Used to blank a word form
     * for cloze cards.
     */
    tokens: text('tokens', { mode: 'json' }).$type<SentenceToken[]>(),
    /** Corpus the sentence came from, e.g. "tatoeba:12345". */
    source: text('source').notNull(),
    /** SPDX-style licence id, e.g. "CC-BY-2.0-FR". */
    licence: text('licence').notNull(),
  },
  (t) => [index('sentence_source_idx').on(t.source)],
);

export const grammarPoint = sqliteTable(
  'grammar_point',
  {
    id: integer('id').primaryKey(),
    title: text('title').notNull(),
    /** Acquisition order; lower is taught first. */
    order: integer('order').notNull(),
    prerequisiteIds: text('prerequisite_ids', { mode: 'json' }).$type<number[]>().notNull(),
    noteMd: text('note_md').notNull(),
  },
  (t) => [uniqueIndex('grammar_point_order_unique').on(t.order)],
);

// ---------------------------------------------------------------------------
// Learner data
// ---------------------------------------------------------------------------

export const card = sqliteTable(
  'card',
  {
    id: text('id').primaryKey(),
    kind: text('kind', { enum: tuple(CARD_KINDS) }).notNull(),
    /** Id of the lemma, sentence or grammar point the card practises (table implied by kind). */
    targetId: integer('target_id').notNull(),
    promptMode: text('prompt_mode', { enum: tuple(PROMPT_MODES) }).notNull(),
    // FSRS fields: see CardSchedule in @italia/core.
    due: timestamp('due').notNull(),
    stability: real('stability').notNull().default(0),
    difficulty: real('difficulty').notNull().default(0),
    scheduledDays: integer('scheduled_days').notNull().default(0),
    learningSteps: integer('learning_steps').notNull().default(0),
    reps: integer('reps').notNull().default(0),
    lapses: integer('lapses').notNull().default(0),
    state: text('state', { enum: tuple(CARD_STATES) })
      .notNull()
      .default('new'),
    lastReview: timestamp('last_review'),
    /** Suspended cards are never scheduled. */
    suspended: integer('suspended', { mode: 'boolean' }).notNull().default(false),
    createdAt: createdAt(),
    // Sync of the card's flags (`suspended`), last-writer-wins by (flagUpdatedAt, flagDeviceId).
    /** When `suspended` last changed, or null if never changed. */
    flagUpdatedAt: timestamp('flag_updated_at'),
    /** Device that made that change; null means this device. */
    flagDeviceId: text('flag_device_id'),
    /** When the current flags were pushed or pulled; null while a change is unsynced. */
    flagSyncedAt: timestamp('flag_synced_at'),
  },
  (t) => [
    uniqueIndex('card_target_unique').on(t.kind, t.targetId, t.promptMode),
    // Serves CardRepo.getDue: equality on suspended, range and order on (due, id).
    index('card_due_order_idx').on(t.suspended, t.due, t.id),
    // Serves CardRepo.getNew and counts by state.
    index('card_state_new_idx').on(t.suspended, t.state, t.createdAt, t.id),
    // Serves the sync push of changed flags.
    index('card_flag_unsynced_idx').on(t.flagSyncedAt, t.flagUpdatedAt),
  ],
);

export const reviewLog = sqliteTable(
  'review_log',
  {
    id: text('id').primaryKey(),
    cardId: text('card_id')
      .notNull()
      .references(() => card.id, { onDelete: 'cascade' }),
    rating: text('rating', { enum: tuple(RATINGS) }).notNull(),
    /** What the learner typed or said (transcript), if anything. */
    answer: text('answer'),
    latencyMs: integer('latency_ms').notNull(),
    reviewedAt: timestamp('reviewed_at').notNull(),
    deviceId: text('device_id').notNull(),
    /** When this row was pushed to the server; null until synced. */
    syncedAt: timestamp('synced_at'),
  },
  (t) => [
    index('review_log_card_reviewed_idx').on(t.cardId, t.reviewedAt),
    // Serves keyset paging by (reviewed_at, id) in ReviewLogRepo.listSince.
    index('review_log_reviewed_id_idx').on(t.reviewedAt, t.id),
    index('review_log_unsynced_idx').on(t.syncedAt),
    check('review_log_latency_nonnegative', sql`${t.latencyMs} >= 0`),
  ],
);

export const story = sqliteTable(
  'story',
  {
    id: text('id').primaryKey(),
    level: text('level', { enum: CEFR_LEVELS }).notNull(),
    seriesId: text('series_id'),
    /** Position within the series, starting at 1. */
    seriesIndex: integer('series_index'),
    title: text('title').notNull(),
    /** Tokens with lemma ids; shape defined by the content schema. */
    bodyJson: text('body_json', { mode: 'json' }).$type<unknown>().notNull(),
    audioRef: text('audio_ref'),
    /** Per-token audio timings in milliseconds; shape defined by the content schema. */
    wordTimings: text('word_timings', { mode: 'json' }).$type<unknown>(),
    source: text('source', { enum: STORY_SOURCES }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('story_level_idx').on(t.level),
    uniqueIndex('story_series_unique').on(t.seriesId, t.seriesIndex),
  ],
);

export const errorRecord = sqliteTable(
  'error_record',
  {
    id: text('id').primaryKey(),
    /** Error taxonomy key, e.g. "agreement.gender". */
    category: text('category').notNull(),
    example: text('example').notNull(),
    source: text('source', { enum: ERROR_SOURCES }).notNull(),
    cardId: text('card_id').references(() => card.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    /** When this row was pushed to (or pulled from) the server; null until synced. */
    syncedAt: timestamp('synced_at'),
  },
  (t) => [
    index('error_record_category_idx').on(t.category),
    index('error_record_card_idx').on(t.cardId),
    index('error_record_unsynced_idx').on(t.syncedAt),
  ],
);

export const studySession = sqliteTable(
  'study_session',
  {
    id: text('id').primaryKey(),
    startedAt: timestamp('started_at').notNull(),
    endedAt: timestamp('ended_at'),
    minutesActive: real('minutes_active').notNull().default(0),
    /** Activity kinds completed in the session, in order. */
    activities: text('activities', { mode: 'json' }).$type<string[]>().notNull(),
    /**
     * When this session was pushed to (or pulled from) the server; null until
     * synced. Sessions are pushed once, after they end, and never change after.
     */
    syncedAt: timestamp('synced_at'),
  },
  (t) => [
    index('study_session_started_idx').on(t.startedAt),
    index('study_session_unsynced_idx').on(t.syncedAt),
  ],
);

/** Key-value settings; values are JSON. Synced last-writer-wins by (updatedAt, deviceId). */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).$type<unknown>().notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  /** Device that wrote the value; null means this device. */
  deviceId: text('device_id'),
  /** When the current value was pushed or pulled; null while a change is unsynced. */
  syncedAt: timestamp('synced_at'),
});

/**
 * Single-row table holding the streak. Not synced: after a sync brings in
 * study sessions from other devices, the streak is replayed from all sessions.
 */
export const streakState = sqliteTable(
  'streak_state',
  {
    id: integer('id').primaryKey(),
    currentDays: integer('current_days').notNull().default(0),
    longestDays: integer('longest_days').notNull().default(0),
    /** Last local calendar day with real study, as YYYY-MM-DD. */
    lastStudyDate: text('last_study_date'),
    freezesAvailable: integer('freezes_available').notNull().default(0),
    // Progress on the most recent local day with any study (`StreakState.day`
    // in @italia/core). All three are null before the first study; StreakRepo
    // writes them together.
    /** That day, as YYYY-MM-DD. */
    dayDate: text('day_date'),
    /** Active minutes recorded on that day. */
    dayActiveMinutes: real('day_active_minutes'),
    /** Sessions completed on that day. */
    dayCompletedSessions: integer('day_completed_sessions'),
    // A missed day that can still be repaired (`StreakState.repair`); all
    // three are null when there is none. StreakRepo writes them together.
    /** The missed day, as YYYY-MM-DD. */
    repairMissedDate: text('repair_missed_date'),
    /** The streak before it broke. */
    repairLostDays: integer('repair_lost_days'),
    /** Freezes the repair will spend. */
    repairFreezesNeeded: integer('repair_freezes_needed'),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (t) => [check('streak_state_singleton', sql`${t.id} = 1`)],
);

/**
 * Device-local key-value metadata (for example the imported seed version and
 * this device's id). Never synced and never included in backups.
 */
export const appMeta = sqliteTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});
