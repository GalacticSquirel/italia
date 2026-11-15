# ADR 0001: pnpm monorepo with Expo, TypeScript and pure-TS packages

- Status: Accepted
- Date: 2026-11-15

## Context

Italia is a mobile app for iOS and Android with a large amount of learning logic (scheduling,
grading, session building, coverage maths) that must be correct and heavily tested. Several agents
will build workstreams in parallel, so code needs clear boundaries. Android is the primary test
platform.

## Decision

- One **pnpm workspaces** monorepo: `apps/mobile` (Expo app), `packages/core` (pure TypeScript
  learning logic), `packages/api-contract` (zod sync DTOs), `packages/content` (build-time content
  pipeline), plus `supabase/`, `models/` and `docs/`.
- **Expo SDK 58**, React Native 0.88, TypeScript strict, Expo Router. A **development build** is
  required (not Expo Go) because the app uses native modules.
- `node-linker=hoisted` so Metro and Expo autolinking see a flat `node_modules`.
- Workspace packages ship TypeScript source (`exports` points at `src/index.ts`); Metro, Jest and
  Vitest compile them directly, so there is no build step.
- `packages/*` must not import React, React Native or Expo (enforced by ESLint).
- Local data in **expo-sqlite + Drizzle ORM** with generated, committed migrations.
- Tests: **Vitest** for packages, **jest-expo + React Native Testing Library** for the app.
- Quality gates: Prettier, ESLint (typescript-eslint strict type-checked, eslint-config-expo,
  import ordering), `tsc`, tests and `expo-doctor` in GitHub Actions. Builds with **EAS**.

## Consequences

- Core logic is testable in Node in milliseconds and can be reused by the content pipeline and
  any future server code.
- Agents working on different packages rarely touch the same files.
- Expo packages must be added with `npx expo install` so versions match the SDK.
- Hoisting means a package can accidentally use an undeclared dependency; reviews must check
  `package.json` changes.
