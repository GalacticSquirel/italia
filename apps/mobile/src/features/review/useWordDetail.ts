import { useMemo } from 'react';

import { isKnown, retrievability, type CardKind, type CardState } from '@italia/core';

import { cardIdFor, toSchedule, type LemmaRow, type Repositories, type SentenceRow } from '@/data';
import { useRepositories } from '@/db';
import { useFocusNow } from '@/features/navigation/useFocusNow';

/** FSRS stats of one card, for display. */
export interface CardStats {
  id: string;
  kind: CardKind;
  state: CardState;
  suspended: boolean;
  due: Date;
  /** Stability in days. */
  stability: number;
  /** Probability of recall now (0 to 1); null before the first review. */
  retrievability: number | null;
  reps: number;
  lapses: number;
  known: boolean;
}

/** Everything the word screen shows. */
export interface WordDetail {
  lemma: LemmaRow;
  sentences: SentenceRow[];
  cards: CardStats[];
  known: boolean;
  /** When the stats were computed. */
  now: Date;
}

const WORD_CARD_KINDS: readonly CardKind[] = ['cloze_production', 'recognition'];

/** Load a word with its example sentences and its cards' FSRS stats (via core). */
export function loadWordDetail(repos: Repositories, lemmaId: number, now: Date): WordDetail | null {
  const lemma = repos.lemmas.getById(lemmaId);
  if (!lemma) return null;
  const cards = WORD_CARD_KINDS.flatMap((kind) => {
    const row = repos.cards.getById(cardIdFor(kind, lemmaId, 'typed'));
    if (!row) return [];
    const schedule = toSchedule(row);
    const started = row.state !== 'new';
    return [
      {
        id: row.id,
        kind: row.kind,
        state: row.state,
        suspended: row.suspended,
        due: row.due,
        stability: row.stability,
        retrievability: started ? retrievability(schedule, now) : null,
        reps: row.reps,
        lapses: row.lapses,
        known: isKnown(schedule, now),
      },
    ];
  });
  return {
    lemma,
    sentences: repos.sentences.listForLemma(lemmaId, 5),
    cards,
    known: cards.some((c) => c.kind === 'cloze_production' && c.known),
    now,
  };
}

/** The word screen's data, refreshed on focus and after suspending. */
export function useWordDetail(lemmaId: number): {
  detail: WordDetail | null;
  setSuspended: (cardId: string, suspended: boolean) => void;
} {
  const repos = useRepositories();
  const [now, refresh] = useFocusNow();
  const detail = useMemo(() => loadWordDetail(repos, lemmaId, now), [repos, lemmaId, now]);
  return {
    detail,
    setSuspended: (cardId, suspended) => {
      repos.cards.suspend(cardId, suspended);
      refresh();
    },
  };
}
