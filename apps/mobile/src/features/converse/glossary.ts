/**
 * Tap-a-word glosses in the conversation: the bundled dictionary first (word
 * forms are matched through the seed sentences' lemma tags), then the glosses
 * the tutor declared for its new words.
 */
import type { NewWord } from '@italia/core';

import type { LemmaRow } from '@/data';
import type { ContentIndex } from '@/features/study/content';

/** A word looked up in a tutor reply. */
export interface WordGloss {
  word: string;
  lemma: string;
  gloss: string;
  /** Where the gloss came from: the app's dictionary, or the tutor model. */
  source: 'dictionary' | 'tutor';
}

/** A piece of a reply: a word that can be tapped, or the text between words. */
export interface ReplyPiece {
  text: string;
  word: boolean;
}

const WORD = /[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu;

/** Split text into words and the spaces and punctuation between them. */
export function splitWords(text: string): ReplyPiece[] {
  const pieces: ReplyPiece[] = [];
  let last = 0;
  for (const match of text.matchAll(WORD)) {
    const at = match.index;
    if (at > last) pieces.push({ text: text.slice(last, at), word: false });
    pieces.push({ text: match[0], word: true });
    last = at + match[0].length;
  }
  if (last < text.length) pieces.push({ text: text.slice(last), word: false });
  return pieces;
}

const forms = new WeakMap<ContentIndex, Map<string, number>>();

/** Word form (lowercase) to the lemma id the content tags it with. */
function formIndex(content: ContentIndex): Map<string, number> {
  const cached = forms.get(content);
  if (cached) return cached;
  const index = new Map<string, number>();
  for (const sentence of content.sentencesByLength) {
    for (const token of sentence.tokens ?? []) {
      const [start, end, lemmaId] = token;
      if (lemmaId === undefined) continue;
      const form = sentence.it.slice(start, end).toLocaleLowerCase('it');
      if (!index.has(form)) index.set(form, lemmaId);
    }
  }
  forms.set(content, index);
  return index;
}

const headwords = new WeakMap<ContentIndex, Map<string, LemmaRow>>();

function headwordIndex(content: ContentIndex): Map<string, LemmaRow> {
  const cached = headwords.get(content);
  if (cached) return cached;
  const index = new Map<string, LemmaRow>();
  for (const l of content.lemmas) {
    const key = l.lemma.toLocaleLowerCase('it');
    if (!index.has(key)) index.set(key, l);
  }
  headwords.set(content, index);
  return index;
}

/** Look a word up; null when neither the dictionary nor the tutor knows it. */
export function lookupWord(
  word: string,
  content: ContentIndex,
  newWords: readonly NewWord[] = [],
): WordGloss | null {
  const lower = word.toLocaleLowerCase('it').replace(/’/gu, "'");
  // "l'acqua": try the whole form, then the word after the elided article.
  const candidates = [lower, ...(lower.includes("'") ? [lower.slice(lower.indexOf("'") + 1)] : [])];
  for (const form of candidates) {
    const lemmaId = formIndex(content).get(form);
    const lemma =
      (lemmaId === undefined ? undefined : content.lemmaById.get(lemmaId)) ??
      headwordIndex(content).get(form);
    if (lemma) return { word, lemma: lemma.lemma, gloss: lemma.glossEn, source: 'dictionary' };
  }
  for (const form of candidates) {
    const declared = newWords.find((w) => w.lemma.toLocaleLowerCase('it') === form);
    if (declared) {
      return { word, lemma: declared.lemma, gloss: declared.glossEn, source: 'tutor' };
    }
  }
  return null;
}
