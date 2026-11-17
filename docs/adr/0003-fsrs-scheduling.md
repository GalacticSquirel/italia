# ADR 0003: FSRS scheduling with ts-fsrs, wrapped in packages/core

- Status: Accepted
- Date: 2026-11-15

## Context

Spaced repetition is the core of the app. FSRS is the best-performing open scheduler on the
srs-benchmark. `ts-fsrs` 6 implements FSRS-3 to FSRS-7 with a composable scheduler API.

## Decision

- Use **ts-fsrs ^6**, wrapped by `createScheduler()` in `packages/core`. App code never imports
  ts-fsrs directly; it uses our `Rating`, `CardSchedule` and `ReviewResult` types.
- Model: **FSRS-6** with default weights for now, because its memory state (stability,
  difficulty) maps directly onto our `card` columns. Moving to FSRS-7 or optimised per-user
  weights later is a replay of review logs (ADR 0002).
- Desired retention defaults to **0.9**; maximum interval is configurable.
- Learning steps 1 and 10 minutes, relearning step 10 minutes, so new and lapsed items come back
  within the same session.
- **Fuzz disabled**: `review(card, rating, now)` is pure and deterministic, so replaying logs gives
  identical state on every device. If load spreading is needed later, use fuzz seeded by card id
  and review count, which stays deterministic.
- `minimal_pair` cards (HVPT ear training) are not scheduled by FSRS.

## Consequences

- The scheduler is a pure function and fully unit tested.
- Upgrading ts-fsrs or changing model only touches `packages/core/src/scheduler.ts` and its
  tests.
- Without fuzz, cards learned together come due together; the session builder must cap daily
  load.
