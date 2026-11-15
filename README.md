# Italia

A React Native (Expo) app for learning Italian toward fluency, built on spaced repetition (FSRS),
graded comprehensible input, and daily speaking practice, with all AI running on-device.

One daily session of 15 to 25 minutes mixes production-first reviews, new words in frequency
order, grammar in acquisition order, a graded story with audio, and speaking practice. It works
fully offline and without an account; optional sign-in syncs learning records across devices via
Supabase. No AI or audio ever leaves the phone.

The full design is in [docs/architecture.md](docs/architecture.md); decisions are recorded in
[docs/adr/](docs/adr/).

## Repository layout

```
apps/mobile/            Expo app: screens, UI components, database, platform code
  src/app/              Expo Router routes ((tabs): Today, Review, Read, Speak, Progress; settings)
  src/ui/               Design system: tokens, ThemeProvider, Text, Button, Card, Screen, ProgressBar
  src/db/               Drizzle schema, database client, DatabaseProvider (runs migrations)
  drizzle/              Generated SQL migrations (committed)
packages/core/          Pure TypeScript learning logic (FSRS scheduler wrapper, ...). No React/Expo.
packages/api-contract/  zod schemas for sync DTOs shared by the app and Supabase functions
packages/content/       Build-time content pipeline (placeholder) and source licences
supabase/               Auth, Postgres migrations, RLS and sync (Phase 2)
training/               Python (uv) pipeline for the on-device tutor model; outside the JS workspace
models/                 Manifest of on-device models (URLs, sizes, checksums, licences); no weights
docs/                   Architecture plan and ADRs
```

## Tutor model training

`training/` holds the pipeline that builds the on-device Italian tutor model: task spec, scenarios,
teacher data generation, SFT and DPO, evaluation and GGUF export. It is a separate Python project
managed with uv and is not part of the pnpm workspace. The primary path runs on an Apple Silicon
Mac Studio (MLX training and a local teacher model); NVIDIA GPUs are the fallback. See
[`training/README.md`](training/README.md) for setup and the runbooks.

## Prerequisites

- Node 24 (`nvm use` reads `.nvmrc`)
- pnpm 10 (`corepack enable` picks the version pinned in `package.json`)
- For device builds: an [Expo account](https://expo.dev) and EAS CLI (`npx eas-cli@latest`), or
  Android Studio (and Xcode on macOS) for local builds
- An Android phone or emulator (Android is the primary test platform; iOS is kept building)

## Setup

```sh
pnpm install
pnpm check        # format check, lint, typecheck, tests
```

## Scripts

Run from the repository root; each runs across all workspaces.

| Script              | What it does                                   |
| ------------------- | ---------------------------------------------- |
| `pnpm lint`         | ESLint (zero warnings allowed)                 |
| `pnpm typecheck`    | `tsc --noEmit` in every workspace              |
| `pnpm test`         | Vitest (packages) and Jest (app)               |
| `pnpm format`       | Prettier, writing changes                      |
| `pnpm format:check` | Prettier, check only                           |
| `pnpm check`        | All of the above checks; run before committing |

In `apps/mobile`:

| Script             | What it does                                           |
| ------------------ | ------------------------------------------------------ |
| `pnpm start`       | Start Metro for the development build                  |
| `pnpm android`     | Build and run a development build locally (Android)    |
| `pnpm ios`         | Build and run a development build locally (iOS, macOS) |
| `pnpm db:generate` | Generate a Drizzle migration after editing `schema.ts` |
| `pnpm doctor`      | Run `expo-doctor`                                      |

## Running on a device (development build)

The app uses native modules (SQLite now; on-device AI later), so it needs a **development
build**. Expo Go is not supported.

With EAS (no local Android SDK needed):

```sh
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest build --profile development --platform android
```

Install the APK from the link EAS prints (scan the QR code on the phone), then start Metro:

```sh
pnpm start
```

Open the Italia dev build on the phone and connect to the Metro server (same Wi-Fi, or
`adb reverse tcp:8081 tcp:8081` over USB).

Locally with Android Studio installed: `cd apps/mobile && pnpm android`.

EAS profiles (`apps/mobile/eas.json`): `development` (dev client, internal distribution, APK),
`development-simulator`, `preview` (internal release build, APK) and `production`.

> The bundle identifier and Android package `com.italia.app` are placeholders. They must be
> changed to an identifier you own before any store release.

## Database changes

1. Edit `apps/mobile/src/db/schema.ts`.
2. `cd apps/mobile && pnpm db:generate --name <change>`.
3. Commit the schema and the generated files in `apps/mobile/drizzle/`. Migrations run
   automatically at app start. Never edit a migration that has been merged.

## Contributing

1. Branch from `main` (`git checkout -b <topic>`).
2. Keep learning logic in `packages/core` with tests; screens only call it.
3. Add Expo-ecosystem dependencies with `npx expo install <pkg>` from `apps/mobile`.
4. Run `pnpm check` and make it pass. Do not disable lint rules to get there.
5. Open a pull request using the template (Summary, Changes, Testing, Screenshots). CI runs
   format, lint, typecheck, tests and `expo-doctor`.

See [CLAUDE.md](CLAUDE.md) for the conventions all contributors (human or agent) follow.
