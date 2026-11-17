# Accounts and sync

Italia is local first (ADR 0002). Every screen reads and writes the SQLite database on the device;
accounts and sync are optional and never on the critical path. Supabase is used **only** for
sign-in and for exchanging learner records between a learner's devices. It runs no AI, stores no
audio and has no Edge Functions: the app talks to PostgREST directly, and row-level security
limits every request to the signed-in user's rows.

- Server schema: `supabase/migrations/` (tests: `supabase/tests/`, run by `pnpm test`).
- Wire formats: `packages/api-contract/src/sync.ts` and `server-rows.ts` (zod).
- App side: `apps/mobile/src/sync/` (engine, Supabase transport, auth, provider) and
  `apps/mobile/src/features/account/AccountSection.tsx` (Settings > Account).

## Set up a Supabase project

1. Create a project at [supabase.com](https://supabase.com/dashboard) (free tier is enough). Pick
   a region near you and keep the database password somewhere safe.
2. Install the CLI (`npx supabase --version` works without a global install), then from the repo
   root link and apply the migrations:

   ```sh
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push            # applies supabase/migrations/*.sql
   npx supabase config push        # optional: auth settings from supabase/config.toml
   ```

   Without the CLI, paste each file in `supabase/migrations/` (in name order) into the dashboard
   SQL editor.

3. **Auth > URL configuration**: add `italia://auth-callback` to the redirect URLs (and
   `exp+italia://auth-callback` for development builds). **Auth > Providers > Email**: keep email
   enabled; the template sends both a magic link and the six-digit code (`{{ .Token }}`). Make sure
   the "Magic Link" email template includes `{{ .Token }}` so the code is shown.
4. **Project settings > API**: copy the project URL and the `anon` public key.

### Local development stack (optional)

`npx supabase start` runs the whole stack in Docker using `supabase/config.toml`, applies the
migrations, and prints a local URL and anon key. Emails land in the local mail catcher (Inbucket,
port 54324). Use your computer's LAN address (for example `http://192.168.1.20:54321`) as the URL
so a phone can reach it; plain `http` is accepted only for localhost and private addresses.

## Configure the app

Create `apps/mobile/.env.local` (git-ignored):

```sh
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
```

The anon key is public by design; row-level security is what protects the data. Never put the
`service_role` key or any other secret in the app. For EAS builds set the same two variables as
EAS environment variables. When either variable is missing or malformed, sync is switched off:
`useSync().enabled` is false, Settings > Account says sync is not set up, and the app works as
before.

### Wiring

- `src/app/_layout.tsx` wraps the app in `<SyncProvider>` inside `<DatabaseProvider>`. It syncs on
  start, whenever the app returns to the foreground, after sign-in, and with exponential backoff
  after failures. `SettingsHydrator` reloads settings after each sync.
- The session store calls `useSync().notifySessionEnded()` when a study session ends (finished or
  quit), so its reviews are pushed straight away.
- Settings shows `<AccountSection />`.
- `src/app/auth-callback.tsx` receives sign-in links and redirects home; `SyncProvider` finishes
  the magic-link sign-in from the deep link itself.

## Sign-in methods

- **Email code / magic link** (works now): `auth.sendEmailCode(email, redirectUrl)` emails a
  six-digit code and a link. Typing the code calls `verifyOtp`; opening the link on the phone
  opens `italia://auth-callback?code=...`, exchanged with PKCE (`exchangeCodeForSession`).
- **Google** (scaffolded): `auth.signInWithIdToken('google', idToken)` is ready, and
  `AccountSection` shows "Continue with Google" when given `getGoogleIdToken`. Still to do:
  1. In Google Cloud, create OAuth clients: a **Web** client (its id and secret go into Supabase
     Auth > Providers > Google), an **Android** client with the package `com.italia.app` and the
     SHA-1 of the debug, upload and Play signing keys, and an **iOS** client for the bundle id.
  2. In Supabase, enable Google and list all client ids (web first, comma separated) under
     "Authorized Client IDs"; enable "Skip nonce check" only if the native library cannot pass a
     nonce.
  3. `npx expo install @react-native-google-signin/google-signin`, add its config plugin to
     `app.json` (with `iosUrlScheme`), rebuild the development build, and implement
     `getGoogleIdToken` with `GoogleSignin.configure({ webClientId })` and `GoogleSignin.signIn()`.
- **Apple** (iOS, not started): needs an Apple Developer account, the "Sign in with Apple"
  capability (`ios.usesAppleSignIn` in `app.json`), `expo-apple-authentication`, and the Apple
  provider enabled in Supabase with the bundle id as client id. The token goes to
  `auth.signInWithIdToken('apple', identityToken, rawNonce)`.

Sessions are stored with `expo-secure-store` (Android Keystore / iOS Keychain), split into chunks
because a session is larger than SecureStore's 2 KB value guidance
(`apps/mobile/src/sync/secureStorage.ts`). Tokens never go to AsyncStorage. Sign-out is local
(`scope: 'local'`), works offline, and keeps the learner's data on the device.

## What syncs

| Server table    | Local source                     | Kind                      |
| --------------- | -------------------------------- | ------------------------- |
| `review_log`    | `review_log`                     | append-only, union by id  |
| `study_session` | `study_session` (once ended)     | append-only, union by id  |
| `error_record`  | `error_record`                   | append-only, union by id  |
| `card_flag`     | `card.suspended` + `flag_*` cols | last writer wins per card |
| `setting`       | `settings`                       | last writer wins per key  |

Not synced, by design:

- **Card FSRS state.** It is a cache of the logs. Card ids are deterministic
  (`kind:targetId:promptMode`), so every device names a card the same way; a pulled log for a card
  the device does not have yet creates it from its id, and every card that gained logs is rebuilt
  with `rebuildCardState` from `@italia/core`.
- **Streak.** Derived: after a pull adds study sessions, the streak is replayed from all sessions
  with `replayStreak` (`@italia/core`); `longestDays` never decreases.
- Content (seeded), stories, app metadata (device id, cursors).

## Protocol

Every server table has `user_id` (row-level security: `auth.uid() = user_id`), a primary key of
`(user_id, id)` (or `(user_id, card_id)`, `(user_id, key)`), and a `server_seq` bigint from a
per-table sequence, indexed with `(user_id, server_seq)`. A trigger assigns `server_seq` while
holding a per-user transaction advisory lock, so one user's rows commit in `server_seq` order and a
cursor can never skip a row that was still being written. Clients cannot choose `server_seq`.

A sync run (`SyncEngine.sync`):

1. **Who.** Read the signed-in user from the stored session (no network). Signed out: skip. A
   different account than last time: reset cursors and mark every local row unsynced, so the
   device's data is pushed to that account.
2. **Push**, table by table, in batches of at most 500 rows (`SYNC_BATCH_MAX`):
   - rows with `synced_at IS NULL` (review logs, error records, ended study sessions, settings) or
     `flag_synced_at IS NULL AND flag_updated_at IS NOT NULL` (card flags);
   - append-only tables: `INSERT ... ON CONFLICT (user_id, id) DO NOTHING`;
   - LWW tables: `INSERT ... ON CONFLICT DO UPDATE`, where a server trigger skips the update
     unless the incoming `(updated_at, device_id)` is greater;
   - after the server accepts a batch, the batch is marked synced locally. LWW rows are marked only
     if they still hold the pushed version, so a change made during the push goes next time.
   - rows that fail the wire schema (for example a legacy non-UUID id) are counted as
     `unpushable` and skipped, so they never block the rest.
3. **Pull**, table by table (settings first), `server_seq > cursor ORDER BY server_seq LIMIT 500`.
   Each page is validated with zod and merged in **one SQLite transaction** together with the
   card rebuilds it causes and the new cursor (`app_meta` `sync.cursor.<table>`), so a crash or
   network failure mid-way leaves a consistent database and the next run resumes after the last
   merged page. A device also pulls back its own rows; merging them is a no-op.
4. Replay the streak if sessions arrived, record `sync.lastSuccessAt`, and report status.

Failures: the run stops, keeps everything already pushed or merged, and schedules a retry with
exponential backoff (5 s doubling to 15 min, with jitter). Errors that a retry cannot fix
(constraint, permission or RLS violations) are not retried automatically. Runs never overlap;
requests during a run queue exactly one more run.

### Conflict rules

- **Review logs, study sessions, error records**: immutable, so there are no conflicts: the union
  by id. The server rejects updates with a trigger (even from privileged roles) and has no update
  or delete grants or policies for clients. A session is pushed once, after it ends.
- **Card state**: replay of the merged logs in `(reviewed_at, id)` order. Replay starts from the
  first log's time, so all devices compute the same state from the same logs. When a pulled
  `desiredRetention` differs from the local one, every card with logs is rebuilt with the new
  scheduler.
- **Settings and card flags**: last writer wins by `(updated_at, device_id)`; equal times are
  broken by the device id, compared bytewise on both server (`COLLATE "C"`) and device. Unknown
  setting keys or values that fail this version's validation are ignored, so a newer app version
  can add settings. `SettingsRepo.reset` is local only; to change a value everywhere, set it.
- **Clocks**: LWW uses device clocks. A device with a wildly wrong clock can win or lose a setting
  change; learning data (logs) is unaffected.
- **Error record card links**: a link to a card the device cannot create (unknown kind) becomes
  null; a pulled review for such a card is skipped (its cursor still advances; `SyncEngine.reset()`
  pulls everything again after an app update).

### Deleting data

Deleting the Supabase user (dashboard, or a future in-app "delete account") cascades to all of
their sync rows. Deleting individual cards is not supported yet; when it is, the server needs a
delete path for that card's logs (ADR 0002).

## Verification

- `supabase/tests/rls.test.ts` runs the migrations on PGlite (Postgres in WebAssembly) with a
  small stand-in for the Supabase `auth` schema (`supabase/tests/auth-shim.sql`) and checks RLS,
  grants, append-only and LWW triggers, `server_seq` and indexes as `anon` and `authenticated`.
- `apps/mobile/src/sync/SyncEngine.test.ts` runs the engine on the real migrated SQLite test
  database against an in-memory server with the same semantics (`testing/FakeSyncServer.ts`):
  two devices converge, re-pushes are idempotent, partial push and pull failures resume, LWW
  settings, backoff, account switch and streak replay.
- Against a real project, after `db push`: sign in on two devices, review on both, sync each
  twice, and compare due dates.
