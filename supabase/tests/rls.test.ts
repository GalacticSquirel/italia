/**
 * Tests of the sync migrations on PGlite (Postgres compiled to WebAssembly).
 *
 * `auth-shim.sql` stands in for the Supabase `auth` schema and roles, so the
 * row-level security policies, grants and triggers run exactly as written.
 * Each request is a transaction with `role authenticated` (or `anon`) and the
 * JWT claims that PostgREST would set, as on the hosted project.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { PGlite, type PGliteInterface, type Transaction } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..');
const MIGRATIONS = path.join(ROOT, 'migrations');

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const LOG_1 = 'aaaaaaaa-0000-4000-8000-000000000001';
const LOG_2 = 'aaaaaaaa-0000-4000-8000-000000000002';

/** Migrated once; each test runs on a fresh clone. */
let template: PGlite;
let db: PGliteInterface;

beforeAll(async () => {
  template = new PGlite();
  await template.exec(readFileSync(path.join(ROOT, 'tests/auth-shim.sql'), 'utf8'));
  for (const file of readdirSync(MIGRATIONS).sort()) {
    await template.exec(readFileSync(path.join(MIGRATIONS, file), 'utf8'));
  }
  await template.query('insert into auth.users (id) values ($1), ($2)', [ALICE, BOB]);
});

afterAll(async () => {
  await template.close();
});

beforeEach(async () => {
  db = await template.clone();
});

afterEach(async () => {
  await db.close();
});

/** Run `fn` as a PostgREST request would: one transaction as `role` with `sub` in the JWT. */
async function as<T>(
  user: string | null,
  fn: (tx: Transaction) => Promise<T>,
  role: 'authenticated' | 'anon' = user === null ? 'anon' : 'authenticated',
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify(user === null ? { role } : { sub: user, role }),
    ]);
    return fn(tx);
  });
}

const insertLog = (tx: Transaction, id: string, extra = '') =>
  tx.query(
    `insert into public.review_log (id, card_id, rating, latency_ms, reviewed_at, device_id${extra === '' ? '' : ', server_seq'})
     values ($1, 'cloze_production:1:typed', 'good', 1200, '2026-11-15T09:00:00.123Z', 'device-a'${extra === '' ? '' : `, ${extra}`})
     on conflict (user_id, id) do nothing`,
    [id],
  );

const upsertSetting = (tx: Transaction, value: string, updatedAt: string, deviceId: string) =>
  tx.query(
    `insert into public.setting (key, value, updated_at, device_id) values ('theme', $1, $2, $3)
     on conflict (user_id, key) do update
       set value = excluded.value, updated_at = excluded.updated_at, device_id = excluded.device_id`,
    [JSON.stringify(value), updatedAt, deviceId],
  );

const rows = async <T>(tx: Transaction, sql: string, params: unknown[] = []): Promise<T[]> =>
  (await tx.query<T>(sql, params)).rows;

const TABLES = ['review_log', 'study_session', 'error_record', 'card_flag', 'setting'];

describe('row-level security', () => {
  it('is enabled on every sync table', async () => {
    const result = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class
       where relnamespace = 'public'::regnamespace and relkind = 'r' order by relname`,
    );
    expect(result.rows.map((r) => r.relname).sort()).toEqual([...TABLES].sort());
    expect(result.rows.every((r) => r.relrowsecurity)).toBe(true);
  });

  it('gives signed-out clients nothing', async () => {
    await as(ALICE, (tx) => insertLog(tx, LOG_1));
    for (const table of TABLES) {
      await expect(as(null, (tx) => tx.query(`select * from public.${table}`))).rejects.toThrow(
        /permission denied/,
      );
    }
    await expect(as(null, (tx) => insertLog(tx, LOG_2))).rejects.toThrow(/permission denied/);
  });

  it('fills user_id from the token and hides other users rows', async () => {
    await as(ALICE, (tx) => insertLog(tx, LOG_1));
    const own = await as(ALICE, (tx) =>
      rows<{ user_id: string }>(tx, 'select user_id from public.review_log'),
    );
    expect(own).toEqual([{ user_id: ALICE }]);
    const other = await as(BOB, (tx) => rows(tx, 'select * from public.review_log'));
    expect(other).toEqual([]);
  });

  it('rejects writing rows for another user', async () => {
    await expect(
      as(BOB, (tx) =>
        tx.query(
          `insert into public.review_log (user_id, id, card_id, rating, latency_ms, reviewed_at, device_id)
           values ($1, $2, 'c', 'good', 1, now(), 'd')`,
          [ALICE, LOG_1],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      as(BOB, (tx) =>
        tx.query(
          `insert into public.setting (user_id, key, value, updated_at, device_id)
           values ($1, 'theme', '"dark"', now(), 'd')`,
          [ALICE],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('cannot change another users settings', async () => {
    await as(ALICE, (tx) => upsertSetting(tx, 'dark', '2026-11-15T10:00:00Z', 'a'));
    const updated = await as(BOB, (tx) =>
      tx.query(
        `update public.setting set value = '"light"', updated_at = now() + interval '1 day'`,
      ),
    );
    expect(updated.affectedRows).toBe(0);
    const value = await as(ALICE, (tx) =>
      rows<{ value: string }>(tx, 'select value from public.setting'),
    );
    expect(value).toEqual([{ value: 'dark' }]);
  });

  it('lets two users hold the same row id', async () => {
    await as(ALICE, (tx) => insertLog(tx, LOG_1));
    await as(BOB, (tx) => insertLog(tx, LOG_1));
    const count = await db.query<{ n: number }>('select count(*)::int as n from public.review_log');
    expect(count.rows[0]?.n).toBe(2);
  });
});

describe('append-only tables', () => {
  it('ignores a re-pushed row', async () => {
    await as(ALICE, (tx) => insertLog(tx, LOG_1));
    await as(ALICE, (tx) => insertLog(tx, LOG_1));
    const all = await as(ALICE, (tx) => rows(tx, 'select id from public.review_log'));
    expect(all).toHaveLength(1);
  });

  it('refuses updates and deletes from clients', async () => {
    await as(ALICE, (tx) => insertLog(tx, LOG_1));
    for (const table of ['review_log', 'study_session', 'error_record']) {
      await expect(
        as(ALICE, (tx) => tx.query(`update public.${table} set user_id = user_id`)),
      ).rejects.toThrow(/permission denied/);
      await expect(as(ALICE, (tx) => tx.query(`delete from public.${table}`))).rejects.toThrow(
        /permission denied/,
      );
    }
  });

  it('refuses updates even from the table owner', async () => {
    await as(ALICE, (tx) => insertLog(tx, LOG_1));
    await expect(db.query(`update public.review_log set rating = 'easy'`)).rejects.toThrow(
      /review_log is append-only/,
    );
  });

  it('validates rows', async () => {
    await expect(
      as(ALICE, (tx) =>
        tx.query(
          `insert into public.review_log (id, card_id, rating, latency_ms, reviewed_at, device_id)
           values ($1, 'c', 'perfect', 1, now(), 'd')`,
          [LOG_1],
        ),
      ),
    ).rejects.toThrow(/check constraint/);
    await expect(
      as(ALICE, (tx) =>
        tx.query(
          `insert into public.study_session (id, started_at, ended_at, minutes_active, activities)
           values ($1, '2026-11-15T10:00:00Z', '2026-11-15T09:00:00Z', 5, '[]')`,
          [LOG_1],
        ),
      ),
    ).rejects.toThrow(/check constraint/);
    await expect(
      as(ALICE, (tx) =>
        tx.query(
          `insert into public.error_record (id, category, example, source, created_at)
           values ($1, 'agreement.gender', 'la libro', 'email', now())`,
          [LOG_1],
        ),
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it('is deleted with the account', async () => {
    await as(ALICE, (tx) => insertLog(tx, LOG_1));
    await db.query('delete from auth.users where id = $1', [ALICE]);
    const count = await db.query<{ n: number }>('select count(*)::int as n from public.review_log');
    expect(count.rows[0]?.n).toBe(0);
  });
});

describe('server_seq', () => {
  it('is assigned by the server, increases, and serves cursor pulls', async () => {
    await as(ALICE, (tx) => insertLog(tx, LOG_1, '999999'));
    await as(ALICE, (tx) => insertLog(tx, LOG_2));
    const all = await as(ALICE, (tx) =>
      rows<{ id: string; server_seq: number }>(
        tx,
        'select id, server_seq::int as server_seq from public.review_log order by server_seq',
      ),
    );
    expect(all.map((r) => r.id)).toEqual([LOG_1, LOG_2]);
    const [first, second] = all;
    expect(first?.server_seq).toBeLessThan(999_999);
    expect(second?.server_seq).toBeGreaterThan(first?.server_seq ?? Infinity);

    const page = await as(ALICE, (tx) =>
      rows<{ id: string }>(
        tx,
        'select id from public.review_log where server_seq > $1 order by server_seq limit 500',
        [first?.server_seq],
      ),
    );
    expect(page).toEqual([{ id: LOG_2 }]);
  });

  it('is indexed by (user_id, server_seq) on every table', async () => {
    const result = await db.query<{ indexdef: string }>(
      `select indexdef from pg_indexes where schemaname = 'public' and indexname like '%_user_seq_idx'`,
    );
    expect(result.rows).toHaveLength(TABLES.length);
    for (const r of result.rows)
      expect(r.indexdef).toMatch(/UNIQUE INDEX .*\(user_id, server_seq\)/);
  });
});

describe('last-writer-wins tables', () => {
  const read = (user: string) =>
    as(user, (tx) =>
      rows<{ value: string; device_id: string; server_seq: number }>(
        tx,
        'select value, device_id, server_seq::int as server_seq from public.setting',
      ),
    );

  it('keeps the newer setting whatever order writes arrive in', async () => {
    await as(ALICE, (tx) => upsertSetting(tx, 'dark', '2026-11-15T10:00:00Z', 'a'));
    const [before] = await read(ALICE);
    await as(ALICE, (tx) => upsertSetting(tx, 'light', '2026-11-15T09:00:00Z', 'b'));
    expect(await read(ALICE)).toEqual([before]);

    await as(ALICE, (tx) => upsertSetting(tx, 'light', '2026-11-15T11:00:00Z', 'b'));
    const [after] = await read(ALICE);
    expect(after?.value).toBe('light');
    expect(after?.server_seq).toBeGreaterThan(before?.server_seq ?? Infinity);
  });

  it('breaks updated_at ties by device id and ignores identical writes', async () => {
    await as(ALICE, (tx) => upsertSetting(tx, 'dark', '2026-11-15T10:00:00Z', 'b'));
    await as(ALICE, (tx) => upsertSetting(tx, 'light', '2026-11-15T10:00:00Z', 'a'));
    expect((await read(ALICE))[0]?.value).toBe('dark');
    const [same] = await read(ALICE);
    await as(ALICE, (tx) => upsertSetting(tx, 'dark', '2026-11-15T10:00:00Z', 'b'));
    expect(await read(ALICE)).toEqual([same]);
    await as(ALICE, (tx) => upsertSetting(tx, 'system', '2026-11-15T10:00:00Z', 'c'));
    expect((await read(ALICE))[0]?.value).toBe('system');
  });

  it('applies to card flags', async () => {
    const flag = (suspended: boolean, updatedAt: string) =>
      as(ALICE, (tx) =>
        tx.query(
          `insert into public.card_flag (card_id, suspended, updated_at, device_id)
           values ('dictation:4:typed', $1, $2, 'a')
           on conflict (user_id, card_id) do update
             set suspended = excluded.suspended, updated_at = excluded.updated_at,
                 device_id = excluded.device_id`,
          [suspended, updatedAt],
        ),
      );
    await flag(true, '2026-11-15T10:00:00Z');
    await flag(false, '2026-11-15T09:00:00Z');
    const stale = await as(ALICE, (tx) =>
      rows<{ suspended: boolean }>(tx, 'select suspended from public.card_flag'),
    );
    expect(stale).toEqual([{ suspended: true }]);
    await flag(false, '2026-11-15T11:00:00Z');
    const fresh = await as(ALICE, (tx) =>
      rows<{ suspended: boolean }>(tx, 'select suspended from public.card_flag'),
    );
    expect(fresh).toEqual([{ suspended: false }]);
  });

  it('does not let clients delete', async () => {
    await as(ALICE, (tx) => upsertSetting(tx, 'dark', '2026-11-15T10:00:00Z', 'a'));
    await expect(as(ALICE, (tx) => tx.query('delete from public.setting'))).rejects.toThrow(
      /permission denied/,
    );
  });
});
