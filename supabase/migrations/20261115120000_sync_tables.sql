-- Sync tables (ADR 0002, docs/sync.md), in the `italia` schema.
--
-- Supabase stores only what devices exchange for log-based sync. Every table is
-- scoped to one user by row-level security. Card FSRS state is NOT stored: each
-- device rebuilds it by replaying review logs. The streak is not stored either:
-- each device derives it from study sessions.
--
-- Every table has a server-assigned `server_seq` (a bigint fed by the table's own
-- sequence, like bigserial, but without a column default). Devices pull rows with
-- `server_seq > cursor` in `server_seq` order and keep one cursor per table.
-- `server_seq` is assigned by a trigger while holding a per-user transaction
-- advisory lock, so a user's rows become visible in `server_seq` order and a
-- pull can never skip a row that commits late.
--
-- Append-only tables (review_log, study_session, error_record): insert and
-- select only. Devices push with ON CONFLICT DO NOTHING, so re-pushing is
-- harmless. A trigger rejects every update, even from privileged roles.
--
-- Last-writer-wins tables (card_flag, setting): a row changes only when the
-- incoming (updated_at, device_id) is greater than the stored one; anything
-- else is silently ignored by a trigger, whoever sends it.

-- Everything lives in its own schemas so the app can share a (self-hosted)
-- Supabase database with other projects: `italia` holds the tables the API
-- exposes (add it to the API's exposed schemas, PGRST_DB_SCHEMAS), and
-- `italia_private` holds the trigger functions, which nobody can call.

create schema if not exists italia;
revoke all on schema italia from public;
-- anon gets usage so a signed-out request is refused by table grants, not by
-- schema lookup; it has no table grants at all.
grant usage on schema italia to anon, authenticated, service_role;

create schema if not exists italia_private;
revoke all on schema italia_private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Trigger functions
-- ---------------------------------------------------------------------------

-- Serialise a user's sync writes and give the row the next sequence value.
-- tg_argv[0] is the table's server_seq sequence.
create function italia_private.assign_server_seq()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('italia.sync:' || new.user_id::text, 0)
  );
  new.server_seq := pg_catalog.nextval(tg_argv[0]::regclass);
  return new;
end;
$$;

-- Append-only tables never change once written.
create function italia_private.reject_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = 'P0001';
end;
$$;

-- Last-writer-wins: keep the stored row unless the incoming one is newer by
-- (updated_at, device_id). Device ids compare bytewise (collation "C") so the
-- server and the devices agree on ties. tg_argv[0] is the server_seq sequence.
create function italia_private.last_writer_wins()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'user_id cannot change' using errcode = 'P0001';
  end if;
  if (new.updated_at, new.device_id collate "C") <= (old.updated_at, old.device_id collate "C") then
    return null; -- older or identical write: skip it
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('italia.sync:' || new.user_id::text, 0)
  );
  new.server_seq := pg_catalog.nextval(tg_argv[0]::regclass);
  return new;
end;
$$;

revoke all on function italia_private.assign_server_seq() from public, anon, authenticated;
revoke all on function italia_private.reject_update() from public, anon, authenticated;
revoke all on function italia_private.last_writer_wins() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- review_log: append-only, the source of truth for card state
-- ---------------------------------------------------------------------------

create sequence italia.review_log_server_seq_seq as bigint;

create table italia.review_log (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id uuid not null,
  card_id text not null check (char_length(card_id) between 1 and 200),
  rating text not null check (rating in ('again', 'hard', 'good', 'easy')),
  answer text check (char_length(answer) <= 4000),
  latency_ms integer not null check (latency_ms >= 0),
  reviewed_at timestamptz not null,
  device_id text not null check (char_length(device_id) between 1 and 100),
  -- Assigned by trigger only (no column default, so clients cannot pick it).
  server_seq bigint not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter sequence italia.review_log_server_seq_seq owned by italia.review_log.server_seq;

create unique index review_log_user_seq_idx on italia.review_log (user_id, server_seq);

create trigger review_log_assign_server_seq
before insert on italia.review_log
for each row execute function italia_private.assign_server_seq('italia.review_log_server_seq_seq');

create trigger review_log_append_only
before update on italia.review_log
for each row execute function italia_private.reject_update();

-- ---------------------------------------------------------------------------
-- study_session: append-only; devices push a session once it has ended
-- ---------------------------------------------------------------------------

create sequence italia.study_session_server_seq_seq as bigint;

create table italia.study_session (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id uuid not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  minutes_active double precision not null check (minutes_active >= 0 and minutes_active <= 1440),
  activities jsonb not null default '[]'::jsonb
    check (jsonb_typeof(activities) = 'array' and pg_column_size(activities) <= 8192),
  -- Assigned by trigger only (no column default, so clients cannot pick it).
  server_seq bigint not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  check (ended_at >= started_at)
);

alter sequence italia.study_session_server_seq_seq owned by italia.study_session.server_seq;

create unique index study_session_user_seq_idx on italia.study_session (user_id, server_seq);

create trigger study_session_assign_server_seq
before insert on italia.study_session
for each row execute function italia_private.assign_server_seq('italia.study_session_server_seq_seq');

create trigger study_session_append_only
before update on italia.study_session
for each row execute function italia_private.reject_update();

-- ---------------------------------------------------------------------------
-- error_record: append-only
-- ---------------------------------------------------------------------------

create sequence italia.error_record_server_seq_seq as bigint;

create table italia.error_record (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id uuid not null,
  category text not null check (char_length(category) between 1 and 200),
  example text not null check (char_length(example) <= 4000),
  source text not null check (source in ('conversation', 'review')),
  card_id text check (char_length(card_id) between 1 and 200),
  created_at timestamptz not null,
  -- Assigned by trigger only (no column default, so clients cannot pick it).
  server_seq bigint not null,
  primary key (user_id, id)
);

alter sequence italia.error_record_server_seq_seq owned by italia.error_record.server_seq;

create unique index error_record_user_seq_idx on italia.error_record (user_id, server_seq);

create trigger error_record_assign_server_seq
before insert on italia.error_record
for each row execute function italia_private.assign_server_seq('italia.error_record_server_seq_seq');

create trigger error_record_append_only
before update on italia.error_record
for each row execute function italia_private.reject_update();

-- ---------------------------------------------------------------------------
-- card_flag: per-card flags (suspended), last-writer-wins
-- ---------------------------------------------------------------------------

create sequence italia.card_flag_server_seq_seq as bigint;

create table italia.card_flag (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id text not null check (char_length(card_id) between 1 and 200),
  suspended boolean not null,
  updated_at timestamptz not null,
  device_id text not null check (char_length(device_id) between 1 and 100),
  -- Assigned by trigger only (no column default, so clients cannot pick it).
  server_seq bigint not null,
  primary key (user_id, card_id)
);

alter sequence italia.card_flag_server_seq_seq owned by italia.card_flag.server_seq;

create unique index card_flag_user_seq_idx on italia.card_flag (user_id, server_seq);

create trigger card_flag_assign_server_seq
before insert on italia.card_flag
for each row execute function italia_private.assign_server_seq('italia.card_flag_server_seq_seq');

create trigger card_flag_last_writer_wins
before update on italia.card_flag
for each row execute function italia_private.last_writer_wins('italia.card_flag_server_seq_seq');

-- ---------------------------------------------------------------------------
-- setting: per-key settings, last-writer-wins
-- ---------------------------------------------------------------------------

create sequence italia.setting_server_seq_seq as bigint;

create table italia.setting (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null check (char_length(key) between 1 and 100),
  value jsonb not null check (pg_column_size(value) <= 8192),
  updated_at timestamptz not null,
  device_id text not null check (char_length(device_id) between 1 and 100),
  -- Assigned by trigger only (no column default, so clients cannot pick it).
  server_seq bigint not null,
  primary key (user_id, key)
);

alter sequence italia.setting_server_seq_seq owned by italia.setting.server_seq;

create unique index setting_user_seq_idx on italia.setting (user_id, server_seq);

create trigger setting_assign_server_seq
before insert on italia.setting
for each row execute function italia_private.assign_server_seq('italia.setting_server_seq_seq');

create trigger setting_last_writer_wins
before update on italia.setting
for each row execute function italia_private.last_writer_wins('italia.setting_server_seq_seq');

-- ---------------------------------------------------------------------------
-- Privileges and row-level security
-- ---------------------------------------------------------------------------

-- Signed-out clients (anon) get nothing. Signed-in clients get exactly the
-- operations sync needs; there is no delete for anyone but the table owner
-- (account deletion cascades from auth.users).
revoke all on table
  italia.review_log, italia.study_session, italia.error_record, italia.card_flag, italia.setting
  from public, anon, authenticated;

grant select, insert on table italia.review_log, italia.study_session, italia.error_record
  to authenticated;
grant select, insert, update on table italia.card_flag, italia.setting to authenticated;
-- The service role (server-side admin scripts only; never in the app)
-- bypasses row-level security, as it does for the public schema.
grant select, insert, update, delete on table
  italia.review_log, italia.study_session, italia.error_record, italia.card_flag, italia.setting
  to service_role;

revoke all on sequence
  italia.review_log_server_seq_seq,
  italia.study_session_server_seq_seq,
  italia.error_record_server_seq_seq,
  italia.card_flag_server_seq_seq,
  italia.setting_server_seq_seq
  from public, anon, authenticated;

alter table italia.review_log enable row level security;
alter table italia.study_session enable row level security;
alter table italia.error_record enable row level security;
alter table italia.card_flag enable row level security;
alter table italia.setting enable row level security;

create policy "review_log: read own" on italia.review_log
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "review_log: insert own" on italia.review_log
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "study_session: read own" on italia.study_session
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "study_session: insert own" on italia.study_session
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "error_record: read own" on italia.error_record
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "error_record: insert own" on italia.error_record
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "card_flag: read own" on italia.card_flag
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "card_flag: insert own" on italia.card_flag
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "card_flag: update own" on italia.card_flag
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "setting: read own" on italia.setting
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "setting: insert own" on italia.setting
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "setting: update own" on italia.setting
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
