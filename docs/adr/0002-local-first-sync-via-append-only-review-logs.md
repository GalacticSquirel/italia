# ADR 0002: Local-first data with append-only review logs, synced via Supabase

- Status: Accepted
- Date: 2026-11-15

## Context

The app must work fully offline and without an account, but the learner also wants accounts and
sync across devices. Reviews happen on several devices, sometimes offline for days. Classic
row-level sync of mutable card state would need conflict resolution for every card.

## Decision

- The device database (SQLite) is the source of truth for the device. Every screen reads and
  writes locally; the network is never on the critical path.
- `review_log` is **append-only**: each review inserts one row with a device-generated UUID, a
  `device_id`, and is never updated or deleted (apart from a local `synced_at` marker).
- Card scheduling state (`card` FSRS columns) is a **cache derived from the logs**: it can always
  be rebuilt by replaying a card's logs in `reviewed_at` order through FSRS.
- Sync (Phase 2) uses **Supabase** Auth and Postgres with row-level security. A device pushes its
  unsynced log rows and pulls rows from other devices since a cursor. Logs **merge by union** on
  `id`; affected cards are recomputed after a pull. Settings use last-writer-wins per key
  (`settings.updated_at`).
- Wire formats are zod schemas in `packages/api-contract`, validated on both ends.
- File export/import remains as a manual backup and merges the same way.

## Consequences

- No conflicts to resolve for learning data, and sync is idempotent.
- Changing scheduler parameters or the FSRS model later only requires a replay.
- Logs grow without bound; at roughly 100 bytes per review this is acceptable for years of daily
  use. Compaction can be added later if needed.
- Deleting a card must cascade its logs locally and on the server.
