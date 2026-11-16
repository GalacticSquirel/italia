-- Sync tables (ADR 0002, docs/sync.md).
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

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Trigger functions
-- ---------------------------------------------------------------------------

-- Serialise a user's sync writes and give the row the next sequence value.
-- tg_argv[0] is the table's server_seq sequence.
create function private.assign_server_seq()
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
create function private.reject_update()
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
create function private.last_writer_wins()
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

revoke all on function private.assign_server_seq() from public, anon, authenticated;
revoke all on function private.reject_update() from public, anon, authenticated;
revoke all on function private.last_writer_wins() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- review_log: append-only, the source of truth for card state
-- ---------------------------------------------------------------------------

create sequence public.review_log_server_seq_seq as bigint;

create table public.review_log (
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

alter sequence public.review_log_server_seq_seq owned by public.review_log.server_seq;

create unique index review_log_user_seq_idx on public.review_log (user_id, server_seq);

create trigger review_log_assign_server_seq
before insert on public.review_log
for each row execute function private.assign_server_seq('public.review_log_server_seq_seq');

create trigger review_log_append_only
before update on public.review_log
for each row execute function private.reject_update();

-- ---------------------------------------------------------------------------
-- study_session: append-only; devices push a session once it has ended
-- ---------------------------------------------------------------------------

create sequence public.study_session_server_seq_seq as bigint;

create table public.study_session (
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

alter sequence public.study_session_server_seq_seq owned by public.study_session.server_seq;

create unique index study_session_user_seq_idx on public.study_session (user_id, server_seq);

create trigger study_session_assign_server_seq
before insert on public.study_session
for each row execute function private.assign_server_seq('public.study_session_server_seq_seq');

create trigger study_session_append_only
before update on public.study_session
for each row execute function private.reject_update();

-- ---------------------------------------------------------------------------
-- error_record: append-only
-- ---------------------------------------------------------------------------

create sequence public.error_record_server_seq_seq as bigint;

create table public.error_record (
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

alter sequence public.error_record_server_seq_seq owned by public.error_record.server_seq;

create unique index error_record_user_seq_idx on public.error_record (user_id, server_seq);

create trigger error_record_assign_server_seq
before insert on public.error_record
for each row execute function private.assign_server_seq('public.error_record_server_seq_seq');

create trigger error_record_append_only
before update on public.error_record
for each row execute function private.reject_update();

-- ---------------------------------------------------------------------------
-- card_flag: per-card flags (suspended), last-writer-wins
-- ---------------------------------------------------------------------------

create sequence public.card_flag_server_seq_seq as bigint;

create table public.card_flag (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id text not null check (char_length(card_id) between 1 and 200),
  suspended boolean not null,
  updated_at timestamptz not null,
  device_id text not null check (char_length(device_id) between 1 and 100),
  -- Assigned by trigger only (no column default, so clients cannot pick it).
  server_seq bigint not null,
  primary key (user_id, card_id)
);

alter sequence public.card_flag_server_seq_seq owned by public.card_flag.server_seq;

create unique index card_flag_user_seq_idx on public.card_flag (user_id, server_seq);

create trigger card_flag_assign_server_seq
before insert on public.card_flag
for each row execute function private.assign_server_seq('public.card_flag_server_seq_seq');

create trigger card_flag_last_writer_wins
before update on public.card_flag
for each row execute function private.last_writer_wins('public.card_flag_server_seq_seq');

-- ---------------------------------------------------------------------------
-- setting: per-key settings, last-writer-wins
-- ---------------------------------------------------------------------------

create sequence public.setting_server_seq_seq as bigint;

create table public.setting (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null check (char_length(key) between 1 and 100),
  value jsonb not null check (pg_column_size(value) <= 8192),
  updated_at timestamptz not null,
  device_id text not null check (char_length(device_id) between 1 and 100),
  -- Assigned by trigger only (no column default, so clients cannot pick it).
  server_seq bigint not null,
  primary key (user_id, key)
);

alter sequence public.setting_server_seq_seq owned by public.setting.server_seq;

create unique index setting_user_seq_idx on public.setting (user_id, server_seq);

create trigger setting_assign_server_seq
before insert on public.setting
for each row execute function private.assign_server_seq('public.setting_server_seq_seq');

create trigger setting_last_writer_wins
before update on public.setting
for each row execute function private.last_writer_wins('public.setting_server_seq_seq');

-- ---------------------------------------------------------------------------
-- Privileges and row-level security
-- ---------------------------------------------------------------------------

-- Signed-out clients (anon) get nothing. Signed-in clients get exactly the
-- operations sync needs; there is no delete for anyone but the table owner
-- (account deletion cascades from auth.users).
revoke all on table
  public.review_log, public.study_session, public.error_record, public.card_flag, public.setting
  from public, anon, authenticated;

grant select, insert on table public.review_log, public.study_session, public.error_record
  to authenticated;
grant select, insert, update on table public.card_flag, public.setting to authenticated;

revoke all on sequence
  public.review_log_server_seq_seq,
  public.study_session_server_seq_seq,
  public.error_record_server_seq_seq,
  public.card_flag_server_seq_seq,
  public.setting_server_seq_seq
  from public, anon, authenticated;

alter table public.review_log enable row level security;
alter table public.study_session enable row level security;
alter table public.error_record enable row level security;
alter table public.card_flag enable row level security;
alter table public.setting enable row level security;

create policy "review_log: read own" on public.review_log
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "review_log: insert own" on public.review_log
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "study_session: read own" on public.study_session
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "study_session: insert own" on public.study_session
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "error_record: read own" on public.error_record
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "error_record: insert own" on public.error_record
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "card_flag: read own" on public.card_flag
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "card_flag: insert own" on public.card_flag
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "card_flag: update own" on public.card_flag
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "setting: read own" on public.setting
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "setting: insert own" on public.setting
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "setting: update own" on public.setting
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
