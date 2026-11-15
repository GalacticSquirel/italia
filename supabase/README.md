# supabase

Empty until Phase 2. This folder will hold the Supabase project for accounts and cross-device sync:

- **Auth**: sign in with Apple, Google and email.
- **Postgres migrations**: tables mirroring the app's local SQLite schema
  (`apps/mobile/src/db/schema.ts`), with row-level security on every user table.
- **Log-based sync**: devices push new `review_log` rows (append-only) and settings changes, and
  pull rows from other devices since a cursor. Logs merge by union; card state is rebuilt on the
  device by replaying logs through FSRS. Payloads are validated with the zod schemas in
  `packages/api-contract`.
- **Edge Functions**: only what sync needs. All AI runs on the device; nothing here calls a model.

The app works fully offline without an account; sync is optional.
