import { describe, expect, it } from 'vitest';

import {
  CardFlagDtoSchema,
  ErrorRecordDtoSchema,
  nextCursor,
  PullRequestSchema,
  PullResponseSchema,
  PushRequestSchema,
  SettingDtoSchema,
  StudySessionDtoSchema,
  SYNC_BATCH_MAX,
  SYNC_TABLES,
  type PullResponse,
  type ReviewLogDto,
} from './index';

const log: ReviewLogDto = {
  id: '3f1c2b9e-8d4a-4e2f-9b7c-1a2b3c4d5e6f',
  cardId: 'cloze_production:1:typed',
  rating: 'good',
  answer: 'buongiorno',
  latencyMs: 2350,
  reviewedAt: '2026-11-15T09:30:00.000Z',
  deviceId: 'device-a',
};

const session = {
  id: '6a1c2b9e-8d4a-4e2f-9b7c-1a2b3c4d5e6f',
  startedAt: '2026-11-15T09:00:00.000Z',
  endedAt: '2026-11-15T09:20:00+00:00',
  minutesActive: 18.5,
  activities: ['review', 'story'],
};

describe('row DTOs', () => {
  it('accepts valid rows of every table', () => {
    expect(
      CardFlagDtoSchema.parse({
        cardId: 'dictation:3:typed',
        suspended: true,
        updatedAt: '2026-11-15T09:30:00.123456+00:00',
        deviceId: 'device-a',
      }).suspended,
    ).toBe(true);
    expect(
      SettingDtoSchema.parse({
        key: 'theme',
        value: { nested: [1, 'a', null, true] },
        updatedAt: '2026-11-15T09:30:00Z',
        deviceId: 'device-a',
      }).key,
    ).toBe('theme');
    expect(StudySessionDtoSchema.parse(session)).toEqual(session);
    expect(
      ErrorRecordDtoSchema.parse({
        id: log.id,
        category: 'agreement.gender',
        example: 'la libro',
        source: 'review',
        cardId: null,
        createdAt: '2026-11-15T09:30:00Z',
      }).cardId,
    ).toBeNull();
  });

  it('rejects non-JSON setting values', () => {
    const base = { key: 'k', updatedAt: '2026-11-15T09:30:00Z', deviceId: 'd' };
    expect(SettingDtoSchema.safeParse({ ...base, value: Number.NaN }).success).toBe(false);
    expect(SettingDtoSchema.safeParse({ ...base, value: undefined }).success).toBe(false);
    expect(SettingDtoSchema.safeParse({ ...base, value: new Date() }).success).toBe(false);
  });

  it('rejects a session that ends before it starts, or has not ended', () => {
    expect(
      StudySessionDtoSchema.safeParse({ ...session, endedAt: '2026-11-15T08:00:00Z' }).success,
    ).toBe(false);
    expect(StudySessionDtoSchema.safeParse({ ...session, endedAt: null }).success).toBe(false);
  });

  it('rejects unknown fields and error sources', () => {
    expect(
      CardFlagDtoSchema.safeParse({
        cardId: 'c',
        suspended: false,
        updatedAt: '2026-11-15T09:30:00Z',
        deviceId: 'd',
        extra: 1,
      }).success,
    ).toBe(false);
    expect(
      ErrorRecordDtoSchema.safeParse({
        id: log.id,
        category: 'x',
        example: '',
        source: 'email',
        cardId: null,
        createdAt: '2026-11-15T09:30:00Z',
      }).success,
    ).toBe(false);
  });
});

describe('PushRequestSchema', () => {
  it('accepts a batch for a table and checks rows against that table', () => {
    expect(PushRequestSchema.parse({ table: 'review_log', rows: [log] }).rows).toHaveLength(1);
    expect(PushRequestSchema.safeParse({ table: 'study_session', rows: [log] }).success).toBe(
      false,
    );
  });

  it('caps batches and refuses empty ones', () => {
    const many = Array.from({ length: SYNC_BATCH_MAX + 1 }, () => log);
    expect(PushRequestSchema.safeParse({ table: 'review_log', rows: many }).success).toBe(false);
    expect(PushRequestSchema.safeParse({ table: 'review_log', rows: many.slice(1) }).success).toBe(
      true,
    );
    expect(PushRequestSchema.safeParse({ table: 'review_log', rows: [] }).success).toBe(false);
  });

  it('rejects unknown tables', () => {
    expect(PushRequestSchema.safeParse({ table: 'card', rows: [log] }).success).toBe(false);
    expect(SYNC_TABLES).not.toContain('card');
  });
});

describe('PullRequestSchema', () => {
  it('needs a non-negative cursor and a limit within the batch cap', () => {
    expect(PullRequestSchema.parse({ table: 'setting', after: 0, limit: 500 }).after).toBe(0);
    expect(PullRequestSchema.safeParse({ table: 'setting', after: -1, limit: 10 }).success).toBe(
      false,
    );
    expect(PullRequestSchema.safeParse({ table: 'setting', after: 0, limit: 501 }).success).toBe(
      false,
    );
    expect(PullRequestSchema.safeParse({ table: 'setting', after: 1.5, limit: 1 }).success).toBe(
      false,
    );
  });
});

describe('PullResponseSchema', () => {
  const page: PullResponse = {
    table: 'review_log',
    rows: [
      { serverSeq: 3, row: log },
      { serverSeq: 7, row: { ...log, id: '4f1c2b9e-8d4a-4e2f-9b7c-1a2b3c4d5e6f' } },
    ],
    hasMore: false,
  };

  it('accepts rows in increasing serverSeq order and yields the next cursor', () => {
    const parsed = PullResponseSchema.parse(page);
    expect(nextCursor(parsed, 0)).toBe(7);
    expect(nextCursor({ table: 'setting', rows: [], hasMore: false }, 4)).toBe(4);
  });

  it('rejects out-of-order rows and rows of another table', () => {
    expect(PullResponseSchema.safeParse({ ...page, rows: [...page.rows].reverse() }).success).toBe(
      false,
    );
    expect(PullResponseSchema.safeParse({ ...page, table: 'card_flag' }).success).toBe(false);
  });
});
