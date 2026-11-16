import { describe, expect, it } from 'vitest';

import {
  fromServerRow,
  SYNC_TABLE_SPECS,
  SYNC_TABLES,
  toServerRow,
  type ReviewLogDto,
  type StudySessionDto,
} from './index';

const USER = '11111111-1111-4111-8111-111111111111';

const log: ReviewLogDto = {
  id: '3f1c2b9e-8d4a-4e2f-9b7c-1a2b3c4d5e6f',
  cardId: 'cloze_production:1:typed',
  rating: 'hard',
  answer: null,
  latencyMs: 900,
  reviewedAt: '2026-11-15T09:30:00.123Z',
  deviceId: 'device-a',
};

describe('server rows', () => {
  it('maps a review log to snake_case with the user id', () => {
    expect(toServerRow('review_log', log, USER)).toEqual({
      user_id: USER,
      id: log.id,
      card_id: log.cardId,
      rating: 'hard',
      answer: null,
      latency_ms: 900,
      reviewed_at: log.reviewedAt,
      device_id: 'device-a',
    });
  });

  it('round-trips rows of every table through the server shape', () => {
    const session: StudySessionDto = {
      id: log.id,
      startedAt: '2026-11-15T09:00:00.000Z',
      endedAt: '2026-11-15T09:10:00.000Z',
      minutesActive: 9.5,
      activities: ['review'],
    };
    const samples = {
      review_log: log,
      card_flag: {
        cardId: log.cardId,
        suspended: true,
        updatedAt: '2026-11-15T09:30:00Z',
        deviceId: 'd',
      },
      setting: { key: 'theme', value: 'dark', updatedAt: '2026-11-15T09:30:00Z', deviceId: 'd' },
      study_session: session,
      error_record: {
        id: log.id,
        category: 'agreement.gender',
        example: 'la libro',
        source: 'review' as const,
        cardId: null,
        createdAt: '2026-11-15T09:30:00Z',
      },
    };
    for (const table of SYNC_TABLES) {
      const { user_id: _u, ...server } = toServerRow(table, samples[table], USER);
      const back = fromServerRow(table, { ...server, server_seq: 42 });
      expect(back).toEqual({ serverSeq: 42, row: samples[table] });
      for (const column of Object.keys(server)) {
        expect(SYNC_TABLE_SPECS[table].selectColumns).toContain(column);
      }
    }
  });

  it('accepts Postgres timestamps and bigint sequences sent as strings', () => {
    const { user_id: _u, ...server } = toServerRow('review_log', log, USER);
    const back = fromServerRow('review_log', {
      ...server,
      reviewed_at: '2026-11-15T09:30:00.123+00:00',
      server_seq: '9007199254740',
    });
    expect(back.serverSeq).toBe(9_007_199_254_740);
    expect(Date.parse(back.row.reviewedAt)).toBe(Date.parse(log.reviewedAt));
  });

  it('rejects server rows that break the DTO rules', () => {
    const { user_id: _u, ...server } = toServerRow('review_log', log, USER);
    expect(() =>
      fromServerRow('review_log', { ...server, rating: 'perfect', server_seq: 1 }),
    ).toThrow();
    expect(() => fromServerRow('review_log', { ...server, server_seq: 0 })).toThrow();
    expect(() => fromServerRow('review_log', server)).toThrow();
  });

  it('uses primary keys as conflict targets', () => {
    expect(SYNC_TABLE_SPECS.review_log).toMatchObject({
      conflictColumns: ['user_id', 'id'],
      appendOnly: true,
    });
    expect(SYNC_TABLE_SPECS.setting).toMatchObject({
      conflictColumns: ['user_id', 'key'],
      appendOnly: false,
    });
    expect(SYNC_TABLE_SPECS.card_flag.appendOnly).toBe(false);
  });
});
