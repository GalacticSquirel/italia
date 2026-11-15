import { z } from 'zod';

import { CARD_KINDS, CARD_STATES, PROMPT_MODES, RATINGS } from '@italia/core';

import { ERROR_SOURCES } from '@/db/schema';

/** Identifies a backup file. */
export const BACKUP_FORMAT = 'italia-backup';

/**
 * Version of the backup file layout. Bump it when a field changes meaning or
 * is removed, and teach {@link importBackup} to read older versions.
 */
export const BACKUP_SCHEMA_VERSION = 1;

const tuple = <T extends string>(values: readonly T[]): [T, ...T[]] => values as [T, ...T[]];
/** Times are integer milliseconds since the Unix epoch. */
const ms = z.number().int();

/** A card in a backup. */
export const BackupCardSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(tuple(CARD_KINDS)),
  targetId: z.number().int(),
  promptMode: z.enum(tuple(PROMPT_MODES)),
  due: ms,
  stability: z.number(),
  difficulty: z.number(),
  scheduledDays: z.number().int(),
  learningSteps: z.number().int(),
  reps: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  state: z.enum(tuple(CARD_STATES)),
  lastReview: ms.nullable(),
  suspended: z.boolean(),
  createdAt: ms,
});

/** A review log row in a backup. */
export const BackupReviewLogSchema = z.object({
  id: z.string().min(1),
  cardId: z.string().min(1),
  rating: z.enum(tuple(RATINGS)),
  answer: z.string().nullable(),
  latencyMs: z.number().int().nonnegative(),
  reviewedAt: ms,
  deviceId: z.string().min(1),
  syncedAt: ms.nullable(),
});

/** A setting in a backup (value validated per key on import). */
export const BackupSettingSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
  updatedAt: ms,
});

/** The streak in a backup. */
export const BackupStreakSchema = z.object({
  currentDays: z.number().int().nonnegative(),
  longestDays: z.number().int().nonnegative(),
  lastStudyDate: z.string().nullable(),
  freezesAvailable: z.number().int().nonnegative(),
  /** Progress on the most recent day with study; absent in older backups. */
  day: z
    .object({
      date: z.string(),
      activeMinutes: z.number().nonnegative(),
      completedSessions: z.number().int().nonnegative(),
    })
    .nullable()
    .default(null),
  /** A missed day that can still be repaired; absent in older backups. */
  repair: z
    .object({
      missedDate: z.string(),
      lostDays: z.number().int().nonnegative(),
      freezesNeeded: z.number().int().nonnegative(),
    })
    .nullable()
    .default(null),
  updatedAt: ms,
});

/** A study session in a backup. */
export const BackupStudySessionSchema = z.object({
  id: z.string().min(1),
  startedAt: ms,
  endedAt: ms.nullable(),
  minutesActive: z.number().nonnegative(),
  activities: z.array(z.string()),
});

/** An error record in a backup. */
export const BackupErrorRecordSchema = z.object({
  id: z.string().min(1),
  category: z.string().min(1),
  example: z.string(),
  source: z.enum(ERROR_SOURCES),
  cardId: z.string().nullable(),
  createdAt: ms,
});

/** A sentence corrected in conversation, in a backup. */
export const BackupLearnerSentenceSchema = z.object({
  id: z.number().int().negative(),
  it: z.string().min(1),
  original: z.string(),
  errorTags: z.array(z.string()),
  grammarIds: z.array(z.number().int()),
  source: z.enum(ERROR_SOURCES),
  createdAt: ms,
});

/** Reading progress on one story in a backup. */
export const BackupStoryProgressSchema = z.object({
  storyId: z.string().min(1),
  startedAt: ms,
  completedAt: ms.nullable(),
  timesRead: z.number().int().nonnegative(),
  lastSentence: z.number().int().nonnegative(),
  wordsRead: z.number().int().nonnegative(),
  comprehensionCorrect: z.number().int().nonnegative().nullable(),
  comprehensionTotal: z.number().int().nonnegative().nullable(),
  updatedAt: ms,
});

/** Exposure count of one lemma in a backup. */
export const BackupLemmaExposureSchema = z.object({
  lemmaId: z.number().int(),
  count: z.number().int().nonnegative(),
  firstSeenAt: ms,
  lastSeenAt: ms,
});

/** A complete backup of the learner's data (content is not included; it comes from the seed). */
export const BackupFileSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  schemaVersion: z.number().int().positive(),
  /** ISO 8601 time of export. */
  exportedAt: z.string(),
  /** Seed version imported on the exporting device, for diagnostics. */
  seedVersion: z.union([z.number(), z.string()]).nullable(),
  cards: z.array(BackupCardSchema),
  reviewLogs: z.array(BackupReviewLogSchema),
  settings: z.array(BackupSettingSchema),
  streakState: BackupStreakSchema.nullable(),
  studySessions: z.array(BackupStudySessionSchema),
  errorRecords: z.array(BackupErrorRecordSchema),
  /** Absent in backups made before conversations existed. */
  learnerSentences: z.array(BackupLearnerSentenceSchema).optional(),
  /** Reading progress; absent in older backups. */
  storyProgress: z.array(BackupStoryProgressSchema).default([]),
  /** Words met in stories; absent in older backups. */
  lemmaExposure: z.array(BackupLemmaExposureSchema).default([]),
});

/** A backup file. */
export type BackupFile = z.infer<typeof BackupFileSchema>;
