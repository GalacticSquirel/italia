import type { ReviewLogDto } from '@italia/api-contract';

import { authCodeFromUrl } from './auth';
import { createSupabaseTransport, type SyncBackend } from './supabaseTransport';
import { SyncTransportError } from './transport';

const USER = '11111111-1111-4111-8111-111111111111';
const log: ReviewLogDto = {
  id: '3f1c2b9e-8d4a-4e2f-9b7c-1a2b3c4d5e6f',
  cardId: 'cloze_production:1:typed',
  rating: 'good',
  answer: null,
  latencyMs: 900,
  reviewedAt: '2026-11-15T09:30:00.000Z',
  deviceId: 'device-a',
};

function fakeBackend(overrides: Partial<SyncBackend> = {}) {
  const calls: unknown[][] = [];
  const backend: SyncBackend = {
    getUserId: () => Promise.resolve({ userId: USER, error: null }),
    upsert: (...args) => {
      calls.push(['upsert', ...args]);
      return Promise.resolve({ error: null });
    },
    selectSince: (...args) => {
      calls.push(['select', ...args]);
      return Promise.resolve({ data: [], error: null });
    },
    ...overrides,
  };
  return { backend, calls };
}

describe('createSupabaseTransport', () => {
  it('pushes append-only rows with ON CONFLICT DO NOTHING as the signed-in user', async () => {
    const { backend, calls } = fakeBackend();
    await createSupabaseTransport(backend).push({ table: 'review_log', rows: [log] });
    expect(calls).toEqual([
      [
        'upsert',
        'review_log',
        [expect.objectContaining({ user_id: USER, id: log.id, reviewed_at: log.reviewedAt })],
        { onConflict: 'user_id,id', ignoreDuplicates: true },
      ],
    ]);
  });

  it('pushes last-writer-wins rows as upserts', async () => {
    const { backend, calls } = fakeBackend();
    await createSupabaseTransport(backend).push({
      table: 'setting',
      rows: [{ key: 'theme', value: 'dark', updatedAt: log.reviewedAt, deviceId: 'd' }],
    });
    expect(calls[0]?.[3]).toEqual({ onConflict: 'user_id,key', ignoreDuplicates: false });
  });

  it('pulls rows since the cursor and maps them to DTOs', async () => {
    const { backend, calls } = fakeBackend({
      selectSince: (...args) => {
        calls.push(['select', ...args]);
        return Promise.resolve({
          data: [
            {
              id: log.id,
              card_id: log.cardId,
              rating: 'good',
              answer: null,
              latency_ms: 900,
              reviewed_at: '2026-11-15T09:30:00+00:00',
              device_id: 'device-a',
              server_seq: 12,
            },
          ],
          error: null,
        });
      },
    });
    const page = await createSupabaseTransport(backend).pull({
      table: 'review_log',
      after: 11,
      limit: 1,
    });
    expect(calls[0]).toEqual([
      'select',
      'review_log',
      'id,card_id,rating,answer,latency_ms,reviewed_at,device_id,server_seq',
      11,
      1,
    ]);
    expect(page).toMatchObject({ table: 'review_log', hasMore: true });
    expect(page.rows[0]).toEqual({
      serverSeq: 12,
      row: { ...log, reviewedAt: '2026-11-15T09:30:00+00:00' },
    });
  });

  it('marks constraint and permission errors as not retryable', async () => {
    const failing = (code: string | undefined) =>
      createSupabaseTransport(
        fakeBackend({ upsert: () => Promise.resolve({ error: { message: 'no', code } }) }).backend,
      ).push({ table: 'review_log', rows: [log] });
    await expect(failing('42501')).rejects.toMatchObject({ retryable: false, code: '42501' });
    await expect(failing('23514')).rejects.toMatchObject({ retryable: false });
    await expect(failing('PGRST301')).rejects.toMatchObject({ retryable: true });
    await expect(failing(undefined)).rejects.toBeInstanceOf(SyncTransportError);
  });

  it('reports signed out without the network', async () => {
    const transport = createSupabaseTransport(
      fakeBackend({ getUserId: () => Promise.resolve({ userId: null, error: null }) }).backend,
    );
    expect(await transport.getUserId()).toBeNull();
    await expect(transport.push({ table: 'review_log', rows: [log] })).rejects.toThrow(
      'signed out',
    );
  });
});

describe('authCodeFromUrl', () => {
  it('finds the PKCE code in a sign-in deep link', () => {
    expect(authCodeFromUrl('italia://auth-callback?code=abc123')).toBe('abc123');
    expect(authCodeFromUrl('exp+italia://auth-callback/?code=x&type=magiclink#frag')).toBe('x');
    expect(authCodeFromUrl('italia:///auth-callback?code=y')).toBe('y');
  });

  it('ignores other links', () => {
    expect(authCodeFromUrl('italia://review?code=abc')).toBeNull();
    expect(authCodeFromUrl('italia://auth-callback?error=denied')).toBeNull();
    expect(authCodeFromUrl('https://evil.example/auth-callback?code=1')).toBeNull();
  });
});
