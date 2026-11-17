import { describe, expect, it } from 'vitest';

import { ReviewLogDtoSchema, type ReviewLogDto } from './index';

const valid: ReviewLogDto = {
  id: '3f1c2b9e-8d4a-4e2f-9b7c-1a2b3c4d5e6f',
  cardId: 'card-1',
  rating: 'good',
  answer: 'buongiorno',
  latencyMs: 2350,
  reviewedAt: '2026-11-15T09:30:00.000Z',
  deviceId: 'device-a',
};

describe('ReviewLogDtoSchema', () => {
  it('accepts a valid review log', () => {
    expect(ReviewLogDtoSchema.parse(valid)).toEqual(valid);
  });

  it('accepts a null answer and a timestamp with an offset', () => {
    const parsed = ReviewLogDtoSchema.parse({
      ...valid,
      answer: null,
      reviewedAt: '2026-11-15T10:30:00+01:00',
    });
    expect(parsed.answer).toBeNull();
  });

  it.each([
    ['a non-UUID id', { id: 'nope' }],
    ['an unknown rating', { rating: 'perfect' }],
    ['a negative latency', { latencyMs: -1 }],
    ['a fractional latency', { latencyMs: 1.5 }],
    ['a non-ISO timestamp', { reviewedAt: '15/11/2026' }],
    ['an empty device id', { deviceId: '' }],
    ['an unknown field', { extra: true }],
  ])('rejects %s', (_label, patch) => {
    expect(ReviewLogDtoSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });

  it('rejects a missing field', () => {
    const { deviceId: _omitted, ...rest } = valid;
    expect(ReviewLogDtoSchema.safeParse(rest).success).toBe(false);
  });
});
