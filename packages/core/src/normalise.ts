/** Typographic apostrophes and look-alikes, all mapped to `'`. */
const APOSTROPHES = /[‘’‛ʼ`´′]/gu;
/** Hyphens, dashes and slashes, which separate words. */
const SEPARATORS = /[-‐-―−/_]/gu;
/** Anything that is not a letter, digit, space or apostrophe. */
const DISALLOWED = /[^\p{L}\p{N}\s']/gu;
const WHITESPACE = /\s+/gu;
/**
 * Spaces around an elision apostrophe after a consonant ("l' acqua",
 * "dov' è"). After a vowel the apostrophe usually marks a truncation that
 * stands alone ("un po' di"), so those spaces are kept.
 */
const ELISION = /([b-df-hj-np-tv-z])\s*'\s*(?=\p{L})/gu;
const LEADING_APOSTROPHES = /^'+/u;
/** A vowel followed by an apostrophe at the end of a word ("perche'", "po'"). */
const VOWEL_APOSTROPHE = /([aeiou])'(?=\s|$)/gu;
const COMBINING_MARKS = /\p{M}/gu;

/**
 * Normalise an Italian answer for comparison: Unicode NFC, lower case,
 * typographic apostrophes to `'`, punctuation removed (hyphens and slashes
 * become spaces), whitespace collapsed, and elision spacing closed up
 * (`l' acqua` and `l 'acqua` both become `l'acqua`). Accents are kept.
 */
export function normaliseAnswer(text: string): string {
  return text
    .normalize('NFC')
    .toLocaleLowerCase('it')
    .replace(APOSTROPHES, "'")
    .replace(SEPARATORS, ' ')
    .replace(DISALLOWED, '')
    .replace(WHITESPACE, ' ')
    .trim()
    .replace(ELISION, "$1'")
    .replace(LEADING_APOSTROPHES, '')
    .trim();
}

/**
 * Remove accents from a normalised answer, and treat the keyboard
 * convention of a vowel plus apostrophe ("perche'") as an accent, so that
 * "perche", "perchè", "perche'" and "perché" share one key.
 */
export function accentKey(normalised: string): string {
  return normalised
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(VOWEL_APOSTROPHE, '$1')
    .normalize('NFC');
}
