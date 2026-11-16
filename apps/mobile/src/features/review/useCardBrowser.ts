import { useMemo } from 'react';

import type { CardState } from '@italia/core';

import type { CardCounts, CardRow, LemmaRow, Repositories } from '@/data';
import { useRepositories } from '@/db';
import { useFocusNow } from '@/features/navigation/useFocusNow';
import { getContentIndex } from '@/features/study/content';
import { formatDue, KIND_NAMES } from '@/features/study/format';

/** Browse filters: unsuspended cards by state, or suspended cards. */
export type BrowseFilter = CardState | 'suspended';

/** Filters in display order. */
export const BROWSE_FILTERS: readonly BrowseFilter[] = [
  'review',
  'learning',
  'relearning',
  'new',
  'suspended',
];

/** A card as a browse row. */
export interface CardListItem {
  id: string;
  title: string;
  subtitle: string;
  detail: string;
  suspended: boolean;
  /** Lemma to open in the word screen, when the card practises one. */
  lemmaId: number | null;
}

const PAGE = 200;

/** Describe a card for a list row. */
export function describeCard(card: CardRow, repos: Repositories, now: Date): CardListItem {
  const content = getContentIndex(repos);
  const lemmaTarget = card.kind === 'recognition' || card.kind === 'cloze_production';
  const lemma = lemmaTarget ? content.lemmaById.get(card.targetId) : undefined;
  const sentence = lemmaTarget ? undefined : content.sentenceById.get(card.targetId);
  return {
    id: card.id,
    title: lemma?.lemma ?? sentence?.it ?? 'Missing content',
    subtitle: [KIND_NAMES[card.kind], lemma?.glossEn ?? sentence?.en].filter(Boolean).join(' · '),
    detail: card.suspended
      ? 'suspended'
      : card.state === 'new'
        ? 'not started'
        : formatDue(card.due, now),
    suspended: card.suspended,
    lemmaId: lemma?.id ?? sentence?.lemmaIds[0] ?? null,
  };
}

/** Result of {@link useCardBrowser}. */
export interface CardBrowser {
  counts: CardCounts;
  cards: CardListItem[];
  lemmas: LemmaRow[];
  setSuspended: (cardId: string, suspended: boolean) => void;
}

/**
 * Cards in a filter, or lemmas matching a search query when one is given.
 * Refreshes on focus and after suspending.
 */
export function useCardBrowser(filter: BrowseFilter, query: string): CardBrowser {
  const repos = useRepositories();
  const [now, refresh] = useFocusNow();
  const { counts, cards } = useMemo(
    () => ({
      counts: repos.cards.countsByState(),
      cards:
        query.trim() === ''
          ? repos.cards
              .listByFilter(filter, { limit: PAGE })
              .map((c) => describeCard(c, repos, now))
          : [],
    }),
    [repos, filter, query, now],
  );
  const lemmas = useMemo(() => repos.lemmas.search(query, { limit: PAGE }), [repos, query]);
  return {
    counts,
    cards,
    lemmas,
    setSuspended: (cardId, suspended) => {
      repos.cards.suspend(cardId, suspended);
      refresh();
    },
  };
}
