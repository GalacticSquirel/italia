# Conventions for working in this repository

Read `docs/architecture.md` and `docs/adr/` before starting. These rules apply to every
change.

## Architecture rules

- **No server-side AI, ever.** All AI (LLM, speech to text, TTS, pronunciation) runs on the
  device (ADR 0004). Supabase is used only for accounts and log-based sync (ADR 0002); it never
  calls a model. Never add API keys for AI services.
- **The app must work offline and signed out.** Every screen reads and writes the local SQLite
  database; network is never on the critical path.
- **Learning logic lives in `packages/core`** (scheduling, grading, session building, streaks,
  progress, coverage). It is pure TypeScript and must not import React, React Native or Expo
  (ESLint enforces this for all of `packages/*`). Screens call it; they do not reimplement it.
- **Never import `ts-fsrs` outside `packages/core`.** Use `createScheduler()` and our types.
- **Wire formats live in `packages/api-contract`** as zod schemas with inferred types. Anything
  sent to or received from Supabase is validated with them.
- **`review_log` is append-only.** Insert rows; never update or delete them (except the local
  `synced_at` marker). Card FSRS state must stay rebuildable by replaying logs.
- **Database changes** go through `apps/mobile/src/db/schema.ts` and
  `pnpm db:generate --name <change>` in `apps/mobile`. Commit the generated migration. Never edit a
  merged migration.
- **Model weights are never committed.** Add models to `models/manifest.json` (id, kind, licence,
  and per file url, sha256, sizeBytes; see `models/README.md`).
- **Content sources** must be listed with their licence in `packages/content/LICENSES.md`.
- Packages ship TypeScript source (`exports` -> `src/index.ts`); there is no build step. Export
  public API only through each package's `src/index.ts` and document it with TSDoc.

## App rules

- Expo SDK 58. A **development build is required** (Expo Go cannot load our native modules).
- Add Expo-ecosystem packages with `npx expo install <pkg>` from `apps/mobile`, never by hand, so
  versions match the SDK. Do not add packages that are not needed.
- Routes live in `apps/mobile/src/app/` (Expo Router); non-route code goes elsewhere in `src/`.
  Import app code via the `@/` alias.
- UI uses the design system in `apps/mobile/src/ui` (tokens via `useTheme()`); no hard-coded
  colours or sizes. Support light and dark mode, screen readers (roles and labels), touch targets
  of at least 44pt (we use 48), and dynamic type (do not fix text heights).
- Do not create or edit `ios/` or `android/`; configure native behaviour in `app.json` and config
  plugins.
- Android is the primary test platform; keep iOS building.

## Testing and checks

- **Tests are required** for new logic: Vitest in `packages/*` (`src/**/*.test.ts`), jest-expo +
  React Native Testing Library in the app (`src/**/*.test.tsx`; RNTL 14 APIs are async, so
  `await render(...)`).
- **Run `pnpm check` (format, lint, typecheck, tests) from the root before every commit**, and
  `npx expo-doctor` in `apps/mobile` after dependency changes. Fix problems; do not disable or
  weaken lint rules or type checks to make them pass.

## Git

- Work on a branch, one pull request per workstream, using the PR template.
- Never put AI model or assistant names in code, comments or docs, apart from the trailer lines
  a commit message is asked to carry.
