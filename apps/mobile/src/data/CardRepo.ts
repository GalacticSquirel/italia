import { and, asc, count, eq, inArray, lte, ne } from 'drizzle-orm';

import {
  CARD_STATES,
  type CardKind,
  type CardSchedule,
  type CardState,
  type PromptMode,
} from '@italia/core';

import { card } from '@/db/schema';
import type { AppDatabase } from '@/db/types';

import { cardIdFor } from './ids';
import type { CardRow, NewCardRow } from './rows';
import { chunk, MAX_IDS_PER_QUERY, MAX_PARAMS_PER_STATEMENT } from './util';

/** What is needed to create a card. */
export interface NewCardInput {
  kind: CardKind;
  /** Id of the lemma, sentence or grammar point practised. */
  targetId: number;
  promptMode: PromptMode;
  /** Initial scheduling fields, normally `scheduler.newCard(now)` from `@italia/core`. */
  schedule: CardSchedule;
  /** Creation time; defaults to now. */
  createdAt?: Date;
}

/** Card counts by FSRS state (unsuspended cards only) plus suspended and total. */
export type CardCounts = Record<CardState, number> & { suspended: number; total: number };

/** Thrown when a card id does not exist. */
export class CardNotFoundError extends Error {
  constructor(readonly cardId: string) {
    super(`Card not found: ${cardId}`);
    this.name = 'CardNotFoundError';
  }
}

/** Practice cards and their FSRS state. */
export interface CardRepo {
  /**
   * Create a card with the deterministic id from {@link cardIdFor}. If the
   * card already exists it is returned unchanged.
   */
  create(input: NewCardInput): CardRow;
  /** {@link CardRepo.create} for many cards in one transaction; returns them in input order. */
  createMany(inputs: readonly NewCardInput[]): CardRow[];
  /** The card with this id, or null. */
  getById(id: string): CardRow | null;
  /** Cards practising this target, optionally narrowed to one prompt mode. */
  getByTarget(kind: CardKind, targetId: number, promptMode?: PromptMode): CardRow[];
  /**
   * Cards already introduced (not `new`), not suspended, and due at or before
   * `now`, most overdue first (ties by id), at most `limit`.
   */
  getDue(now: Date, limit: number): CardRow[];
  /** Number of cards {@link CardRepo.getDue} would return with no limit. */
  countDue(now: Date): number;
  /** Unsuspended cards never reviewed, oldest first (ties by id), at most `limit`. */
  getNew(limit: number): CardRow[];
  /**
   * Replace a card's FSRS fields with `schedule` (computed by `@italia/core`).
   *
   * @throws CardNotFoundError when the card does not exist
   */
  upsertState(id: string, schedule: CardSchedule): void;
  /**
   * Suspend (or unsuspend) a card at `now`; suspended cards are never due.
   * The change is marked for sync (last writer wins by time of change).
   *
   * @throws CardNotFoundError when the card does not exist
   */
  suspend(id: string, suspended?: boolean, now?: Date): void;
  /** Card counts by state. */
  countsByState(): CardCounts;
}

/** The FSRS fields of a card row, as `@italia/core` expects them. */
export function toSchedule(row: CardRow): CardSchedule {
  return {
    due: row.due,
    stability: row.stability,
    difficulty: row.difficulty,
    scheduledDays: row.scheduledDays,
    learningSteps: row.learningSteps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    lastReview: row.lastReview,
  };
}

function scheduleColumns(schedule: CardSchedule): CardSchedule {
  return {
    due: schedule.due,
    stability: schedule.stability,
    difficulty: schedule.difficulty,
    scheduledDays: schedule.scheduledDays,
    learningSteps: schedule.learningSteps,
    reps: schedule.reps,
    lapses: schedule.lapses,
    state: schedule.state,
    lastReview: schedule.lastReview,
  };
}

function toInsert(input: NewCardInput): NewCardRow {
  return {
    id: cardIdFor(input.kind, input.targetId, input.promptMode),
    kind: input.kind,
    targetId: input.targetId,
    promptMode: input.promptMode,
    ...scheduleColumns(input.schedule),
    createdAt: input.createdAt ?? new Date(),
  };
}

const CARD_COLUMNS = 18;

/** Create a {@link CardRepo}. */
export function createCardRepo(db: AppDatabase): CardRepo {
  const getById = (id: string): CardRow | null =>
    db.select().from(card).where(eq(card.id, id)).get() ?? null;

  const insertMany = (tx: AppDatabase, rows: NewCardRow[]): void => {
    for (const part of chunk(rows, Math.floor(MAX_PARAMS_PER_STATEMENT / CARD_COLUMNS))) {
      tx.insert(card).values(part).onConflictDoNothing().run();
    }
  };

  return {
    create(input) {
      const row = toInsert(input);
      insertMany(db, [row]);
      const created = getById(row.id);
      if (!created) throw new CardNotFoundError(row.id);
      return created;
    },
    createMany(inputs) {
      if (inputs.length === 0) return [];
      const rows = inputs.map(toInsert);
      return db.transaction((tx) => {
        insertMany(tx, rows);
        const ids = rows.map((r) => r.id);
        const byId = new Map<string, CardRow>();
        for (const part of chunk(ids, MAX_IDS_PER_QUERY)) {
          for (const r of tx.select().from(card).where(inArray(card.id, part)).all()) {
            byId.set(r.id, r);
          }
        }
        return ids.map((id) => {
          const r = byId.get(id);
          if (!r) throw new CardNotFoundError(id);
          return r;
        });
      });
    },
    getById,
    getByTarget(kind, targetId, promptMode) {
      return db
        .select()
        .from(card)
        .where(
          and(
            eq(card.kind, kind),
            eq(card.targetId, targetId),
            promptMode === undefined ? undefined : eq(card.promptMode, promptMode),
          ),
        )
        .orderBy(asc(card.promptMode))
        .all();
    },
    getDue(now, limit) {
      return db
        .select()
        .from(card)
        .where(and(eq(card.suspended, false), lte(card.due, now), ne(card.state, 'new')))
        .orderBy(asc(card.due), asc(card.id))
        .limit(limit)
        .all();
    },
    countDue(now) {
      return (
        db
          .select({ n: count() })
          .from(card)
          .where(and(eq(card.suspended, false), lte(card.due, now), ne(card.state, 'new')))
          .get()?.n ?? 0
      );
    },
    getNew(limit) {
      return db
        .select()
        .from(card)
        .where(and(eq(card.suspended, false), eq(card.state, 'new')))
        .orderBy(asc(card.createdAt), asc(card.id))
        .limit(limit)
        .all();
    },
    upsertState(id, schedule) {
      const updated = db
        .update(card)
        .set(scheduleColumns(schedule))
        .where(eq(card.id, id))
        .returning({ id: card.id })
        .all();
      if (updated.length === 0) throw new CardNotFoundError(id);
    },
    suspend(id, suspended = true, now = new Date()) {
      const updated = db
        .update(card)
        .set({ suspended, flagUpdatedAt: now, flagDeviceId: null, flagSyncedAt: null })
        .where(eq(card.id, id))
        .returning({ id: card.id })
        .all();
      if (updated.length === 0) throw new CardNotFoundError(id);
    },
    countsByState() {
      const counts = Object.fromEntries(CARD_STATES.map((s) => [s, 0])) as Record<
        CardState,
        number
      >;
      let suspended = 0;
      let total = 0;
      const rows = db
        .select({ state: card.state, suspended: card.suspended, n: count() })
        .from(card)
        .groupBy(card.suspended, card.state)
        .all();
      for (const row of rows) {
        total += row.n;
        if (row.suspended) suspended += row.n;
        else counts[row.state] += row.n;
      }
      return { ...counts, suspended, total };
    },
  };
}
