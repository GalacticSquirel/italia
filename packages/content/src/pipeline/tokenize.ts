/** Italian word tokenizer used for Tatoeba sentences. */

export interface Token {
  /** Surface text as written (apostrophes normalised to U+0027). */
  readonly text: string;
  /** Lower-case form used for lexicon lookup. */
  readonly lower: string;
  /** UTF-16 offsets into the original sentence. */
  readonly start: number;
  readonly end: number;
  /** Contains a digit (sentences with digits are skipped). */
  readonly numeric: boolean;
}

// A word is a run of letters (and digits), optionally ending in an apostrophe:
// "l'acqua" -> "l'", "acqua"; "un po' di" -> "un", "po'", "di".
const WORD = /[\p{L}\p{N}]+(?:['’ʼ])?/gu;

/** Split a sentence into word tokens; punctuation is dropped. */
export function tokenize(sentence: string): Token[] {
  const tokens: Token[] = [];
  for (const match of sentence.matchAll(WORD)) {
    const raw = match[0];
    const text = raw.replace(/[’ʼ]/g, "'");
    tokens.push({
      text,
      lower: text.toLowerCase(),
      start: match.index,
      end: match.index + raw.length,
      numeric: /\p{N}/u.test(raw),
    });
  }
  return tokens;
}
