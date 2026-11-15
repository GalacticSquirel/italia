# supabase

The Supabase project for accounts and cross-device sync. Supabase is used only for sign-in and
log-based sync; nothing here calls a model or stores audio. The app works fully offline and
signed out; sync is optional.

- `config.toml`: project config for `supabase start` (local stack) and `supabase config push`.
- `migrations/`: user-scoped sync tables (`review_log`, `study_session`, `error_record`,
  `card_flag`, `setting`) with row-level security, append-only and last-writer-wins triggers, and
  server-assigned `server_seq` pull cursors.
- `tests/`: Vitest tests that apply the migrations to PGlite with a stand-in for the Supabase
  `auth` schema and check the policies and triggers (`pnpm test`).

Setup, environment variables and the sync protocol: [docs/sync.md](../docs/sync.md).
