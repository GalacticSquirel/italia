import type { CardKind, PromptMode } from '@italia/core';

import type { GrammarPointRow, LearnerSentenceRow, LemmaRow, SentenceRow } from '@/data';

import { grammarFocus, type ContentIndex } from './content';

/** Card kinds the app can show (minimal pairs have their own adaptive drill). */
export const SHOWN_KINDS = [
  'recognition',
  'cloze_production',
  'sentence_production',
  'dictation',
  'grammar_cloze',
  'spoken_prompt',
] as const satisfies readonly CardKind[];

/** A card kind the app can show. */
export type ShownKind = (typeof SHOWN_KINDS)[number];

/** Whether a kind is one the app can show. */
export function isShownKind(kind: CardKind): kind is ShownKind {
  return (SHOWN_KINDS as readonly CardKind[]).includes(kind);
}

/** How a card kind is answered: spoken prompts by speaking, the rest by typing. */
export function promptModeFor(kind: CardKind): PromptMode {
  return kind === 'spoken_prompt' ? 'spoken' : 'typed';
}

/** A sentence with one word form cut out. */
export interface Blank {
  before: string;
  /** The word form as written in the sentence: the expected answer. */
  answer: string;
  after: string;
}

/** First exposure to a word. */
export interface RecognitionPrompt {
  kind: 'recognition';
  lemma: LemmaRow;
  example: SentenceRow | null;
}

/** Fill in a word in an Italian sentence, with the English sentence as the cue. */
export interface ClozePrompt {
  kind: 'cloze_production';
  lemma: LemmaRow;
  sentence: SentenceRow;
  blank: Blank;
  accepted: string[];
}

/** Fill in the grammar-bearing word (usually the verb) from its dictionary form. */
export interface GrammarClozePrompt {
  kind: 'grammar_cloze';
  sentence: SentenceRow;
  blank: Blank;
  /** The dictionary form of the missing word, shown as a hint. */
  baseForm: string;
  grammarPoint: GrammarPointRow | null;
  accepted: string[];
}

/**
 * Translate an English sentence into Italian, or, for a sentence corrected in
 * conversation (`correction` set), write the learner's sentence correctly.
 */
export interface SentenceProductionPrompt {
  kind: 'sentence_production';
  sentence: SentenceRow;
  accepted: string[];
  /** For a correction card: what the learner wrote in conversation. */
  correction?: { original: string; errorTags: readonly string[] };
}

/** Listen to an Italian sentence and type it. */
export interface DictationPrompt {
  kind: 'dictation';
  sentence: SentenceRow;
  accepted: string[];
}

/**
 * Pimsleur-style spoken prompt: hear (and see) an English cue, say the
 * Italian, then hear the model answer.
 */
export interface SpokenPrompt {
  kind: 'spoken_prompt';
  sentence: SentenceRow;
  accepted: string[];
}

/** Everything needed to show one card. */
export type Prompt =
  | RecognitionPrompt
  | ClozePrompt
  | GrammarClozePrompt
  | SentenceProductionPrompt
  | DictationPrompt
  | SpokenPrompt;

/** A prompt that is answered by typing. */
export type TypedPrompt = Exclude<Prompt, RecognitionPrompt | SpokenPrompt>;

/** Most words in a sentence used as a spoken prompt (short enough to say from memory). */
export const SPOKEN_PROMPT_MAX_WORDS = 8;

/** Words in an Italian sentence. */
export function wordCount(text: string): number {
  return text.split(/\s+/u).filter((w) => /\p{L}/u.test(w)).length;
}

/** What {@link resolvePrompt} needs to know about a card. */
export interface PromptCard {
  kind: CardKind;
  targetId: number;
  /** Reviews so far; rotates the example sentence used by cloze cards. */
  reps: number;
}

/** Example sentences a cloze card rotates through. */
const CLOZE_SENTENCE_POOL = 5;

function blankAt(it: string, start: number, end: number): Blank {
  return { before: it.slice(0, start), answer: it.slice(start, end), after: it.slice(end) };
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Where `lemma` appears in `sentence`: from the sentence's tokens, or (for a
 * seed without tokens) where the headword itself appears as a whole word.
 */
export function blankForLemma(sentence: SentenceRow, lemma: LemmaRow): Blank | null {
  if (sentence.tokens) {
    const token = sentence.tokens.find(([, , ...ids]) => ids.includes(lemma.id));
    return token ? blankAt(sentence.it, token[0], token[1]) : null;
  }
  const match = new RegExp(`(^|[^\\p{L}])(${escapeRegExp(lemma.lemma)})(?![\\p{L}])`, 'iu').exec(
    sentence.it,
  );
  if (!match) return null;
  const start = match.index + (match[1]?.length ?? 0);
  return blankAt(sentence.it, start, start + lemma.lemma.length);
}

const GRAMMAR_BLANK_POS = [['VERB', 'AUX'], ['DET']] as const;

/**
 * The word a grammar cloze blanks: the first verb, or failing that the first
 * article, of a sentence with tokens. Returns the blank and the word's lemma.
 */
export function grammarBlank(
  sentence: SentenceRow,
  content: ContentIndex,
): { blank: Blank; lemma: LemmaRow } | null {
  if (!sentence.tokens) return null;
  for (const tags of GRAMMAR_BLANK_POS) {
    for (const [start, end, ...ids] of sentence.tokens) {
      const lemma = ids.length === 1 ? content.lemmaById.get(ids[0] ?? -1) : undefined;
      if (lemma && (tags as readonly string[]).includes(lemma.pos)) {
        return { blank: blankAt(sentence.it, start, end), lemma };
      }
    }
  }
  return null;
}

/** Sentences a lemma's cloze card can use, shortest first. */
export function clozeSentences(lemma: LemmaRow, content: ContentIndex): SentenceRow[] {
  const out: SentenceRow[] = [];
  for (const s of content.sentencesByLemma.get(lemma.id) ?? []) {
    if (blankForLemma(s, lemma)) out.push(s);
    if (out.length >= CLOZE_SENTENCE_POOL) break;
  }
  return out;
}

/**
 * Answers a cloze accepts: its own blank, plus the blank of every other seed
 * sentence for the lemma that has the same English and the same words around
 * the blank. Tatoeba often holds one sentence per person or gender with one
 * translation ("Che mi ha fatto?", "Che mi hai fatto?", "Che mi avete fatto?"
 * are all "What did you do to me?"), so from the English alone each of those
 * forms is right.
 */
export function clozeAnswers(
  sentence: SentenceRow,
  blank: Blank,
  lemma: LemmaRow,
  content: ContentIndex,
): string[] {
  const answers = [blank.answer];
  for (const other of content.sentencesByLemma.get(lemma.id) ?? []) {
    if (other.id === sentence.id || other.en !== sentence.en) continue;
    const b = blankForLemma(other, lemma);
    if (b?.before === blank.before && b.after === blank.after && !answers.includes(b.answer)) {
      answers.push(b.answer);
    }
  }
  return answers;
}

/**
 * Resolve a card into what to show, or null when its content is missing (for
 * example after a seed update removed it) or its kind is not shown yet.
 *
 * Targets: `recognition` and `cloze_production` practise a lemma;
 * `grammar_cloze`, `sentence_production`, `dictation` and `spoken_prompt`
 * practise a sentence.
 */
export function resolvePrompt(card: PromptCard, content: ContentIndex): Prompt | null {
  switch (card.kind) {
    case 'recognition': {
      const lemma = content.lemmaById.get(card.targetId);
      if (!lemma) return null;
      return { kind: 'recognition', lemma, example: clozeSentences(lemma, content)[0] ?? null };
    }
    case 'cloze_production': {
      const lemma = content.lemmaById.get(card.targetId);
      if (!lemma) return null;
      const pool = clozeSentences(lemma, content);
      const sentence = pool[card.reps % Math.max(1, pool.length)];
      const blank = sentence ? blankForLemma(sentence, lemma) : null;
      if (!sentence || !blank) return null;
      return {
        kind: 'cloze_production',
        lemma,
        sentence,
        blank,
        accepted: clozeAnswers(sentence, blank, lemma, content),
      };
    }
    case 'grammar_cloze': {
      const sentence = content.sentenceById.get(card.targetId);
      const found = sentence ? grammarBlank(sentence, content) : null;
      if (!sentence || !found) return null;
      const focus = grammarFocus(sentence, content);
      return {
        kind: 'grammar_cloze',
        sentence,
        blank: found.blank,
        baseForm: found.lemma.lemma,
        grammarPoint: focus === null ? null : (content.grammarById.get(focus) ?? null),
        accepted: [found.blank.answer],
      };
    }
    case 'sentence_production': {
      if (card.targetId < 0) {
        const learner = content.learnerSentenceById.get(card.targetId);
        if (!learner) return null;
        return {
          kind: 'sentence_production',
          sentence: learnerSentenceRow(learner),
          accepted: [learner.it],
          correction: { original: learner.original, errorTags: learner.errorTags },
        };
      }
      const sentence = content.sentenceById.get(card.targetId);
      if (!sentence) return null;
      return { kind: card.kind, sentence, accepted: [sentence.it] };
    }
    case 'dictation':
    case 'spoken_prompt': {
      const sentence = content.sentenceById.get(card.targetId);
      if (!sentence) return null;
      return { kind: card.kind, sentence, accepted: [sentence.it] };
    }
    case 'minimal_pair':
      return null;
  }
}

/** A learner sentence in the shape of a content sentence (no English, no lemma tags). */
function learnerSentenceRow(row: LearnerSentenceRow): SentenceRow {
  return {
    id: row.id,
    it: row.it,
    en: '',
    lemmaIds: [],
    grammarIds: row.grammarIds,
    tokens: null,
    source: `conversation:${row.source}`,
    licence: 'learner',
  };
}

/** The lemmas a card practises (for known-word counts and interleaving). */
export function cardLemmaIds(card: Pick<PromptCard, 'kind' | 'targetId'>, content: ContentIndex) {
  switch (card.kind) {
    case 'recognition':
    case 'cloze_production':
      return [card.targetId];
    default:
      return content.sentenceById.get(card.targetId)?.lemmaIds ?? [];
  }
}

/** The grammar points a card practises: a sentence card's focus point, if any. */
export function cardGrammarIds(
  card: Pick<PromptCard, 'kind' | 'targetId'>,
  content: ContentIndex,
): number[] {
  if (card.kind === 'recognition' || card.kind === 'cloze_production') return [];
  if (card.targetId < 0)
    return [...(content.learnerSentenceById.get(card.targetId)?.grammarIds ?? [])];
  const sentence = content.sentenceById.get(card.targetId);
  const focus = sentence ? grammarFocus(sentence, content) : null;
  return focus === null ? [] : [focus];
}
