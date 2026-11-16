/**
 * Italian compound numerals (ventotto, trentatré, duecentocinquanta, duemilasei)
 * are written as one word but built from a few basic numbers. The seed teaches
 * the basic numbers; a compound is read as its parts, so "ventotto" is
 * venti + otto, and a learner who knows both can read it.
 *
 * Pure: no IO.
 */

/** Units 1-9 as they appear inside a compound, with the lemma they stand for. */
const UNITS: readonly (readonly [string, string])[] = [
  ['uno', 'uno'],
  ['due', 'due'],
  ['tré', 'tre'],
  ['tre', 'tre'],
  ['quattro', 'quattro'],
  ['cinque', 'cinque'],
  ['sei', 'sei'],
  ['sette', 'sette'],
  ['otto', 'otto'],
  ['nove', 'nove'],
];

/** 10-19, which never combine with a unit. */
const TEENS = [
  'dieci',
  'undici',
  'dodici',
  'tredici',
  'quattordici',
  'quindici',
  'sedici',
  'diciassette',
  'diciotto',
  'diciannove',
];

/** 20-90. The final vowel drops before uno and otto (ventuno, trentotto). */
const TENS = [
  'venti',
  'trenta',
  'quaranta',
  'cinquanta',
  'sessanta',
  'settanta',
  'ottanta',
  'novanta',
];

/** Parse 1-99 into lemmas, or null. */
function belowHundred(s: string): string[] | null {
  if (s === '') return [];
  if (TEENS.includes(s)) return [s];
  for (const [form, lemma] of UNITS) {
    // A final "tre" is written "tré" in compounds, but "tre" alone.
    if (s === form && form !== 'tré') return [lemma];
  }
  for (const ten of TENS) {
    const elided = ten.slice(0, -1);
    if (s === ten) return [ten];
    for (const [form, lemma] of UNITS) {
      const joined = form === 'uno' || form === 'otto' ? elided : ten;
      // ventitré is the standard spelling; ventitre is common in casual writing.
      if (s === joined + form) return [ten, lemma];
    }
  }
  return null;
}

/** Parse 1-999 into lemmas, or null. */
function belowThousand(s: string): string[] | null {
  const at = s.indexOf('cento');
  if (at < 0) return belowHundred(s);
  const head = s.slice(0, at);
  const rest = s.slice(at + 'cento'.length);
  const multiplier = head === '' ? [] : belowHundred(head);
  // duecento..novecento: only a unit multiplies cento.
  if (multiplier === null || multiplier.length > 1 || multiplier[0] === 'uno') return null;
  // centootto and centotto are both used.
  const tail = belowHundred(rest) ?? (rest.startsWith('tto') ? belowHundred(`o${rest}`) : null);
  if (tail === null) return null;
  return [...multiplier, 'cento', ...tail];
}

/**
 * Split a compound numeral into the lemmas of its parts: "ventotto" ->
 * [venti, otto], "duemilasei" -> [due, mille, sei]. Returns null for a word
 * that is not a numeral or is a single basic number ("venti", "mille").
 */
export function splitNumeral(word: string): string[] | null {
  const s = word.toLowerCase();
  let parts: string[] | null;
  const mila = s.indexOf('mila');
  if (s.startsWith('mille')) {
    const rest = belowThousand(s.slice('mille'.length));
    parts = rest && ['mille', ...rest];
  } else if (mila > 0) {
    const head = belowThousand(s.slice(0, mila));
    const rest = belowThousand(s.slice(mila + 'mila'.length));
    parts = head && rest && !(head.length === 1 && head[0] === 'uno') ? [...head, 'mille', ...rest] : null;
  } else {
    parts = belowThousand(s);
  }
  return parts && parts.length > 1 ? parts : null;
}
