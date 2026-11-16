import { asc, eq } from 'drizzle-orm';

import { type CEFR_LEVELS, story } from '@/db/schema';
import type { AppDatabase } from '@/db/types';

import type { IdGenerator } from './ids';
import type { NewStoryRow, StoryRow } from './rows';

/** A CEFR band. */
export type CefrLevel = (typeof CEFR_LEVELS)[number];

/** A story to save; `id` defaults to a new UUID and `createdAt` to now. */
export type SaveStoryInput = Omit<NewStoryRow, 'id' | 'createdAt'> & {
  id?: string;
  createdAt?: Date;
};

/** Graded stories, bundled or generated on the device. */
export interface StoryRepo {
  /** Insert a story, or replace the one with the same id. Returns the stored row. */
  save(input: SaveStoryInput): StoryRow;
  /** The story with this id, or null. */
  getById(id: string): StoryRow | null;
  /** Stories at this level, series first in series order, then by creation time. */
  listByLevel(level: CefrLevel): StoryRow[];
  /** Episodes of one series in order. */
  listSeries(seriesId: string): StoryRow[];
}

/** Create a {@link StoryRepo}. */
export function createStoryRepo(db: AppDatabase, newId: IdGenerator): StoryRepo {
  return {
    save(input) {
      const row: NewStoryRow = { ...input, id: input.id ?? newId() };
      if (input.createdAt === undefined) delete row.createdAt;
      const { id: _id, ...updates } = row;
      return db
        .insert(story)
        .values(row)
        .onConflictDoUpdate({ target: story.id, set: updates })
        .returning()
        .get();
    },
    getById(id) {
      return db.select().from(story).where(eq(story.id, id)).get() ?? null;
    },
    listByLevel(level) {
      return db
        .select()
        .from(story)
        .where(eq(story.level, level))
        .orderBy(asc(story.seriesId), asc(story.seriesIndex), asc(story.createdAt), asc(story.id))
        .all();
    },
    listSeries(seriesId) {
      return db
        .select()
        .from(story)
        .where(eq(story.seriesId, seriesId))
        .orderBy(asc(story.seriesIndex))
        .all();
    },
  };
}
