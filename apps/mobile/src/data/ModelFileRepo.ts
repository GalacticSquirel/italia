import { eq } from 'drizzle-orm';

import { modelFile, type MODEL_FILE_STATUSES } from '@/db/schema';
import type { AppDatabase } from '@/db/types';

/** Install state of one model file. */
export type ModelFileStatus = (typeof MODEL_FILE_STATUSES)[number];

/** A row of `model_file`. */
export interface ModelFileRow {
  modelId: string;
  name: string;
  sha256: string;
  status: ModelFileStatus;
  bytesDone: number;
  resumeData: string | null;
  error: string | null;
  updatedAt: Date;
}

/** Device-local install state of model files. Never synced or backed up. */
export interface ModelFileRepo {
  /** Every row of one model, or of all models when `modelId` is omitted. */
  list(modelId?: string): ModelFileRow[];
  /** Insert or replace a row. */
  put(row: Omit<ModelFileRow, 'updatedAt'>, now?: Date): void;
  /** Forget every file of a model. */
  removeModel(modelId: string): void;
}

/** Create a {@link ModelFileRepo}. */
export function createModelFileRepo(db: AppDatabase): ModelFileRepo {
  return {
    list(modelId) {
      const query = db.select().from(modelFile);
      return (modelId === undefined ? query : query.where(eq(modelFile.modelId, modelId))).all();
    },
    put(row, now = new Date()) {
      const values = { ...row, updatedAt: now };
      db.insert(modelFile)
        .values(values)
        .onConflictDoUpdate({ target: [modelFile.modelId, modelFile.name], set: values })
        .run();
    },
    removeModel(modelId) {
      db.delete(modelFile).where(eq(modelFile.modelId, modelId)).run();
    },
  };
}
