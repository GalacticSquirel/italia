/**
 * What the word sheet shows for a tapped word, and "Add to reviews".
 */
import { isKnown } from '@italia/core';

import {
  addToReviews,
  cardIdFor,
  toSchedule,
  type AddToReviewsResult,
  type LemmaRow,
  type Repositories,
  type SentenceRow,
  type StorySentence,
} from '@/data';
import { getContentIndex } from '@/features/study/content';
import { schedulerFor } from '@/features/study/planning';
import { clozeSentences, promptModeFor } from '@/features/study/prompts';

/** The card "Add to reviews" creates: recall of the word in a sentence. */
export const REVIEW_KIND = 'cloze_production';

/**
 * Whether the word is in the learner's reviews:
 * `active`, `suspended`, `none` (can be added), or `unavailable` (no example
 * sentence to practise it with yet).
 */
export type ReviewStatus = 'active' | 'suspended' | 'none' | 'unavailable';

/** A tapped word. */
export interface WordInfo {
  /** The word as written in the story. */
  form: string;
  /** The word's dictionary entry, or null for names and words outside the dictionary. */
  lemma: LemmaRow | null;
  /** Further words packed into this one ("nel" is in + il), in order. */
  parts: LemmaRow[];
  isName: boolean;
  /** An example sentence from the course content (not the story). */
  example: SentenceRow | null;
  /** Times the learner has met this word in finished stories. */
  exposures: number;
  known: boolean;
  review: ReviewStatus;
}

type StoryToken = StorySentence['tokens'][number];

/** Load what the sheet shows for `token`. */
export function loadWordInfo(repos: Repositories, token: StoryToken, now: Date): WordInfo {
  const lemma = token.lemmaId === null ? null : repos.lemmas.getById(token.lemmaId);
  const parts = (token.partIds ?? []).flatMap((id) => {
    const row = repos.lemmas.getById(id);
    return row ? [row] : [];
  });
  const base = {
    form: token.text,
    lemma,
    parts,
    isName: token.isName === true,
  };
  if (!lemma) {
    return { ...base, example: null, exposures: 0, known: false, review: 'unavailable' };
  }
  const content = getContentIndex(repos);
  const card = repos.cards.getById(cardIdFor(REVIEW_KIND, lemma.id, promptModeFor(REVIEW_KIND)));
  const practisable = clozeSentences(lemma, content);
  const review: ReviewStatus = card
    ? card.suspended
      ? 'suspended'
      : 'active'
    : practisable.length > 0
      ? 'none'
      : 'unavailable';
  return {
    ...base,
    example: practisable[0] ?? content.sentencesByLemma.get(lemma.id)?.[0] ?? null,
    exposures: repos.reading.exposureCount(lemma.id),
    known: card !== null && !card.suspended && isKnown(toSchedule(card), now),
    review,
  };
}

/**
 * Put a word's cloze card in the learner's reviews (creating it with its
 * deterministic id, or unsuspending it). The curriculum introduces requested
 * words first, so it appears in the next session. Returns `unavailable` when
 * the word has no example sentence to practise it with.
 */
export function addWordToReviews(
  repos: Repositories,
  lemmaId: number,
  now: Date,
): AddToReviewsResult | 'unavailable' {
  const lemma = repos.lemmas.getById(lemmaId);
  if (!lemma) return 'unavailable';
  const existing = repos.cards.getById(cardIdFor(REVIEW_KIND, lemmaId, promptModeFor(REVIEW_KIND)));
  if (!existing && clozeSentences(lemma, getContentIndex(repos)).length === 0) {
    return 'unavailable';
  }
  const scheduler = schedulerFor(repos.settings.getAll());
  return addToReviews(
    repos.cards,
    {
      kind: REVIEW_KIND,
      targetId: lemmaId,
      promptMode: promptModeFor(REVIEW_KIND),
      schedule: scheduler.newCard(now),
    },
    now,
  );
}
