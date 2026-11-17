import { z } from 'zod';

/** Ratings a review can carry, matching `Rating` in `@italia/core`. */
export const RatingSchema = z.enum(['again', 'hard', 'good', 'easy']);

/**
 * One review as it travels between a device and the sync backend.
 *
 * Review logs are append-only: a device creates each row once and never
 * changes it, so merging logs from several devices is a union by `id`.
 */
export const ReviewLogDtoSchema = z
  .object({
    /** Globally unique id, generated on the device (UUID). */
    id: z.uuid(),
    /** Id of the card that was reviewed. */
    cardId: z.string().min(1),
    /** Rating the review produced. */
    rating: RatingSchema,
    /** What the learner typed or said, if anything. */
    answer: z.string().nullable(),
    /** Time from prompt shown to answer submitted, in milliseconds. */
    latencyMs: z.number().int().nonnegative(),
    /** When the review happened, ISO 8601 with offset. */
    reviewedAt: z.iso.datetime({ offset: true }),
    /** Id of the device that recorded the review. */
    deviceId: z.string().min(1),
  })
  .strict();

/** A review log row in transit. */
export type ReviewLogDto = z.infer<typeof ReviewLogDtoSchema>;
