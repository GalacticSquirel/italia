/**
 * Curriculum: which items could be introduced next, in order. `buildSession`
 * in `@italia/core` takes these candidates and decides how many fit today.
 *
 * Phase 1 rules:
 *
 * - **New words** in frequency order. Each word is two items: a
 *   `recognition` first exposure, then (after the next word's exposure) a
 *   `cloze_production` card, so the word is met and then recalled. Words
 *   without a usable example sentence are skipped.
 * - **Grammar** unlocks in acquisition order. A point is unlocked once one of
 *   its `grammar_cloze` items has been answered; the next point to unlock
 *   (the frontier) is the first locked one with an item available whose
 *   prerequisites are unlocked (a prerequisite with no item available yet
 *   does not block it; see {@link frontierGrammar}).
 * - **Sentence practice** (`grammar_cloze`, `sentence_production`,
 *   `dictation`) uses sentences whose words have all been introduced and
 *   whose main grammar point is unlocked (or is the frontier, for grammar
 *   cloze items, which is how points unlock). One practice item follows
 *   every two new words.
 */
import type { CardKind, NewCandidate } from '@italia/core';

import { cardIdFor, type CardRow, type SentenceRow } from '@/data';

import { grammarFocus, type ContentIndex } from './content';
import { clozeSentences, grammarBlank } from './prompts';

/** Items each new word adds: a recognition card and a cloze card. */
export const ITEMS_PER_NEW_WORD = 2;

/** Sentence-practice items allowed per new word (one per two words). */
export const PRACTICE_ITEMS_PER_NEW_WORD = 0.5;

/** Card kinds that introduce a new word, counted towards the daily new-word limit. */
export const NEW_WORD_KIND: CardKind = 'recognition';

/** Most grammar cloze items introduced for the frontier point per day. */
const FRONTIER_ITEMS = 3;

/** A candidate with the target it practises, so its card can be created. */
export interface CurriculumCandidate extends NewCandidate {
  targetId: number;
  /** True for the first item of a new word. */
  newWord: boolean;
}

/** Result of {@link buildCurriculum}. */
export interface Curriculum {
  candidates: CurriculumCandidate[];
  /** Lemmas whose first exposure has happened. */
  introducedLemmaIds: ReadonlySet<number>;
  /** Grammar points unlocked so far. */
  unlockedGrammarIds: ReadonlySet<number>;
  /** The next grammar point to unlock, if any. */
  frontierGrammarId: number | null;
  /** New words that could still be introduced (before today's limit). */
  wordsAvailable: number;
}

/** Limits for {@link buildCurriculum}. */
export interface CurriculumLimits {
  /** New words still allowed today. */
  words: number;
  /** Sentence-practice items still allowed today. */
  practice: number;
}

function stateIndex(cards: readonly CardRow[]) {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const card = (kind: CardKind, targetId: number) => byId.get(cardIdFor(kind, targetId, 'typed'));
  /** Introduced: answered at least once. */
  const introduced = (kind: CardKind, targetId: number) => {
    const c = card(kind, targetId);
    return c !== undefined && c.state !== 'new';
  };
  /** Available to introduce: not answered and not suspended. */
  const open = (kind: CardKind, targetId: number) => {
    const c = card(kind, targetId);
    return c === undefined || (c.state === 'new' && !c.suspended);
  };
  return { introduced, open };
}

/** The grammar points unlocked by the learner's answered grammar cloze cards. */
export function unlockedGrammar(cards: readonly CardRow[], content: ContentIndex): Set<number> {
  const unlocked = new Set<number>();
  for (const c of cards) {
    if (c.kind !== 'grammar_cloze' || c.state === 'new') continue;
    const sentence = content.sentenceById.get(c.targetId);
    const focus = sentence ? grammarFocus(sentence, content) : null;
    if (focus !== null) unlocked.add(focus);
  }
  return unlocked;
}

/**
 * The next grammar point to unlock, or null when all are unlocked or blocked:
 * the first locked point, in acquisition order, whose prerequisites are
 * satisfied.
 *
 * With `practisable` (the points that have a grammar cloze item the learner
 * could do now), the frontier must be practisable, and a prerequisite that is
 * not practisable yet counts as satisfied. Otherwise a point whose sentences
 * all use words the learner has not met (common for the first points of the
 * real seed, whose sentences mostly practise several points at once) would
 * block every later point.
 */
export function frontierGrammar(
  unlocked: ReadonlySet<number>,
  content: ContentIndex,
  practisable?: ReadonlySet<number>,
): number | null {
  const satisfied = (id: number) =>
    unlocked.has(id) || (practisable !== undefined && !practisable.has(id));
  const next = content.grammar.find(
    (g) =>
      !unlocked.has(g.id) &&
      (practisable === undefined || practisable.has(g.id)) &&
      g.prerequisiteIds.every(satisfied),
  );
  return next?.id ?? null;
}

const candidate = (
  kind: CardKind,
  targetId: number,
  lemmaIds: readonly number[],
  grammarIds: readonly number[],
  newWord = false,
): CurriculumCandidate => ({
  id: cardIdFor(kind, targetId, 'typed'),
  kind,
  targetId,
  lemmaIds,
  grammarIds,
  newWord,
});

/** The practice kind used for a sentence whose grammar is already unlocked. */
function practiceKind(sentence: SentenceRow, content: ContentIndex): CardKind {
  const kinds: CardKind[] = ['sentence_production', 'dictation', 'grammar_cloze'];
  const kind = kinds[sentence.id % kinds.length] ?? 'sentence_production';
  if (kind === 'grammar_cloze' && !grammarBlank(sentence, content)) return 'sentence_production';
  return kind;
}

/**
 * Candidates to introduce next, in curriculum order, within today's limits.
 * Pure: depends only on the content and the learner's cards.
 */
export function buildCurriculum(
  content: ContentIndex,
  cards: readonly CardRow[],
  limits: CurriculumLimits,
): Curriculum {
  const { introduced, open } = stateIndex(cards);
  const introducedLemmaIds = new Set(
    content.lemmas.filter((l) => introduced('recognition', l.id)).map((l) => l.id),
  );
  const unlocked = unlockedGrammar(cards, content);
  const knows = (s: SentenceRow) => s.lemmaIds.every((id) => introducedLemmaIds.has(id));

  // Points with a grammar cloze item available now (all words introduced).
  const practisable = new Set<number>();
  for (const s of content.sentencesByLength) {
    const focus = grammarFocus(s, content);
    if (focus === null || unlocked.has(focus) || practisable.has(focus)) continue;
    if (knows(s) && open('grammar_cloze', s.id) && grammarBlank(s, content)) practisable.add(focus);
  }
  const frontier = frontierGrammar(unlocked, content, practisable);

  // New words: [recognition, cloze] per word, skipping parts already done.
  const words: CurriculumCandidate[][] = [];
  let wordsAvailable = 0;
  for (const lemma of content.lemmas) {
    const needRecognition = open('recognition', lemma.id);
    const needCloze = open('cloze_production', lemma.id);
    if (!needRecognition && !needCloze) continue;
    if (!introduced('recognition', lemma.id) && !needRecognition) continue; // suspended
    if (clozeSentences(lemma, content).length === 0) continue;
    wordsAvailable += 1;
    if (words.length >= limits.words) continue;
    const unit: CurriculumCandidate[] = [];
    if (needRecognition) unit.push(candidate('recognition', lemma.id, [lemma.id], [], true));
    if (needCloze) unit.push(candidate('cloze_production', lemma.id, [lemma.id], []));
    words.push(unit);
  }

  // Sentence practice: frontier grammar first, then unlocked material.
  const frontierItems: CurriculumCandidate[] = [];
  const practice: CurriculumCandidate[] = [];
  if (limits.practice > 0) {
    // Frontier items and other practice are collected separately: frontier
    // sentences are often longer than practice for points already unlocked,
    // and must not be crowded out by them (that would stall grammar).
    const frontierCap = frontier === null ? 0 : Math.min(FRONTIER_ITEMS, limits.practice);
    for (const s of content.sentencesByLength) {
      if (frontierItems.length >= frontierCap && practice.length >= limits.practice) break;
      if (!knows(s)) continue;
      const focus = grammarFocus(s, content);
      const grammarIds = focus === null ? [] : [focus];
      if (focus !== null && focus === frontier) {
        if (
          frontierItems.length < frontierCap &&
          open('grammar_cloze', s.id) &&
          grammarBlank(s, content)
        ) {
          frontierItems.push(candidate('grammar_cloze', s.id, s.lemmaIds, grammarIds));
        }
        continue;
      }
      if (focus !== null && !unlocked.has(focus)) continue;
      if (practice.length >= limits.practice) continue;
      const kind = practiceKind(s, content);
      if (open(kind, s.id) && !introduced(kind, s.id)) {
        practice.push(candidate(kind, s.id, s.lemmaIds, grammarIds));
      }
    }
  }
  const practiceQueue = [...frontierItems, ...practice].slice(0, Math.max(0, limits.practice));

  // Interleave: each word's cloze follows the next word's first exposure, so
  // recall is not immediate; one practice item follows every two words.
  const ordered: CurriculumCandidate[] = [];
  let pendingCloze: CurriculumCandidate | undefined;
  let p = 0;
  words.forEach((unit, i) => {
    const [first, second] = unit;
    const recognition = first?.kind === 'recognition' ? first : undefined;
    const cloze = recognition ? second : first;
    if (recognition) ordered.push(recognition);
    if (pendingCloze) ordered.push(pendingCloze);
    pendingCloze = cloze;
    const next = practiceQueue[p];
    if (i % 2 === 1 && next) {
      ordered.push(next);
      p += 1;
    }
  });
  if (pendingCloze) ordered.push(pendingCloze);
  ordered.push(...practiceQueue.slice(p));

  return {
    candidates: ordered,
    introducedLemmaIds,
    unlockedGrammarIds: unlocked,
    frontierGrammarId: frontier,
    wordsAvailable,
  };
}
