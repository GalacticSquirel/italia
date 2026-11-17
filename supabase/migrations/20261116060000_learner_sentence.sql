-- learner_sentence: sentences the learner corrected in conversation (docs/sync.md).
--
-- Devices practise them as `sentence_production` cards whose card id holds the
-- sentence id, so another device needs the sentence itself to show the card.
-- Ids are negative and derived from the corrected text on the device, so two
-- devices give the same sentence the same id. Append-only, like review_log:
-- insert and select only, re-pushes are ignored, updates are rejected.

create sequence italia.learner_sentence_server_seq_seq as bigint;

create table italia.learner_sentence (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id integer not null check (id < 0),
  it text not null check (char_length(it) between 1 and 4000),
  original text not null check (char_length(original) <= 4000),
  error_tags jsonb not null default '[]'::jsonb
    check (jsonb_typeof(error_tags) = 'array' and pg_column_size(error_tags) <= 8192),
  grammar_ids jsonb not null default '[]'::jsonb
    check (jsonb_typeof(grammar_ids) = 'array' and pg_column_size(grammar_ids) <= 8192),
  source text not null check (source in ('conversation', 'review')),
  created_at timestamptz not null,
  -- Assigned by trigger only (no column default, so clients cannot pick it).
  server_seq bigint not null,
  primary key (user_id, id)
);

alter sequence italia.learner_sentence_server_seq_seq owned by italia.learner_sentence.server_seq;

create unique index learner_sentence_user_seq_idx on italia.learner_sentence (user_id, server_seq);

create trigger learner_sentence_assign_server_seq
before insert on italia.learner_sentence
for each row execute function italia_private.assign_server_seq('italia.learner_sentence_server_seq_seq');

create trigger learner_sentence_append_only
before update on italia.learner_sentence
for each row execute function italia_private.reject_update();

revoke all on table italia.learner_sentence from public, anon, authenticated;
grant select, insert on table italia.learner_sentence to authenticated;
grant select, insert, update, delete on table italia.learner_sentence to service_role;
revoke all on sequence italia.learner_sentence_server_seq_seq from public, anon, authenticated;

alter table italia.learner_sentence enable row level security;

create policy "learner_sentence: read own" on italia.learner_sentence
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "learner_sentence: insert own" on italia.learner_sentence
  for insert to authenticated with check ((select auth.uid()) = user_id);
