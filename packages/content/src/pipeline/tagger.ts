/**
 * A small rule-based tagger: picks one lexicon reading per token from frequency
 * priors plus a few context cues (article before a noun, clitic or "non" before
 * a verb, auxiliary before a participle).
 */
import { type LemmaFrequency, type PosDistribution, readingPriors } from './frequency';
import { type Lexicon, lookup, type Reading, type Upos } from './lexicon';
import { type Token, tokenize } from './tokenize';

export interface TaggedToken extends Token {
  /** Chosen reading, or null when the word is unknown or a proper noun. */
  readonly reading: Reading | null;
  /** Capitalised word the lexicon does not know (or knows only as a name). */
  readonly properNoun: boolean;
}

const SUBJECT_PRONOUNS = new Set(['io', 'tu', 'lui', 'lei', 'noi', 'voi', 'loro']);
const CLITICS = new Set(['mi', 'ti', 'si', 'ci', 'vi', 'lo', 'la', 'li', 'le', 'gli', 'ne']);

const headUpos = (r: Reading): Upos | undefined => r.units[0]?.upos;
const headLemma = (r: Reading): string | undefined => r.units[0]?.lemma;

/** True when a reading is a finite or non-finite form of the verb `lemma`. */
export const isVerb = (r: Reading | null, lemma?: string): boolean =>
  !!r && headUpos(r) === 'VERB' && (lemma === undefined || headLemma(r) === lemma);

export const hasInfl = (r: Reading | null, prefix: string): boolean =>
  !!r && r.infl.some((i) => i.startsWith(prefix));

/** Words that are determiners before a noun even when the lexicon reading is a pronoun. */
const DETERMINER_WORDS = new Set([
  'questo',
  'quello',
  'mio',
  'tuo',
  'suo',
  'nostro',
  'vostro',
  'ogni',
  'qualche',
  'alcuno',
  'nessuno',
  'molto',
  'poco',
  'tanto',
  'troppo',
  'altro',
  'tutto',
  'quale',
]);

function isDeterminerLike(r: Reading): boolean {
  const last = r.units.at(-1);
  const head = r.units[0];
  return (
    headUpos(r) === 'DET' ||
    last?.lemma === 'il' ||
    headUpos(r) === 'NUM' ||
    (head?.upos === 'PRON' && DETERMINER_WORDS.has(head.lemma))
  );
}

function isCliticOrNegation(r: Reading): boolean {
  const u = r.units[0];
  return (
    !!u &&
    ((u.upos === 'PRON' && (CLITICS.has(u.lemma) || SUBJECT_PRONOUNS.has(u.lemma))) ||
      (u.upos === 'ADV' && u.lemma === 'non'))
  );
}

const isAuxForm = (r: Reading): boolean =>
  (isVerb(r, 'essere') || isVerb(r, 'avere')) && headUpos(r) === 'VERB';

function contextFactor(reading: Reading, prev: Reading | null, nextUpos: Set<Upos>): number {
  const upos = headUpos(reading);
  let f = 1;
  if (prev) {
    if (isDeterminerLike(prev)) {
      if (upos === 'NOUN') f *= 6;
      else if (upos === 'ADJ') f *= 2;
      else if (upos === 'VERB') f *= 0.1;
    }
    if (isCliticOrNegation(prev)) {
      if (upos === 'VERB') f *= 6;
      else if (upos === 'NOUN' || upos === 'ADJ') f *= 0.2;
    }
    if (isAuxForm(prev) && upos === 'VERB' && hasInfl(reading, 'part+past')) f *= 6;
  }
  // "la", "le", "gli", "lo", "l'": article before a noun, pronoun before a verb.
  if (upos === 'DET' && (nextUpos.has('NOUN') || nextUpos.has('ADJ'))) f *= 4;
  if (upos === 'PRON' && nextUpos.has('VERB') && !nextUpos.has('NOUN')) f *= 8;
  // An article needs a noun phrase after it: before a word that can only be a
  // verb, "la", "l'", "lo", "le" are object pronouns, as in
  // "Non la avevo" or "Ce la sto facendo". The frequency prior for the article
  // is strong enough to beat the boost above, so penalise the article too.
  if (
    upos === 'DET' &&
    headLemma(reading) === 'il' &&
    nextUpos.size > 0 &&
    [...nextUpos].every((u) => u === 'VERB')
  ) {
    f *= 0.01;
  }
  return f;
}

/**
 * Tag a sentence: tokenise, look up each token and choose a reading.
 *
 * Options: `allowed` keeps only readings whose units satisfy it (e.g. "lemma is
 * in the seed"; a token with none is left untagged); `lemmaFrequency` breaks
 * ties between same-POS readings.
 */
export function tagSentence(
  sentence: string,
  lexicon: Lexicon,
  subtlex: ReadonlyMap<string, PosDistribution>,
  {
    allowed = () => true,
    lemmaFrequency,
  }: { allowed?: (reading: Reading) => boolean; lemmaFrequency?: LemmaFrequency } = {},
): TaggedToken[] {
  const tokens = tokenize(sentence);
  const candidates = tokens.map((t) => {
    const readings = lookup(lexicon, t.lower) ?? [];
    return readings.filter((r) => headUpos(r) !== 'PROPN' && allowed(r));
  });
  const out: TaggedToken[] = [];
  let prev: Reading | null = null;
  tokens.forEach((token, i) => {
    const readings = candidates[i] ?? [];
    const capitalised = /^\p{Lu}/u.test(token.text);
    const known = lookup(lexicon, token.lower);
    const onlyName = !!known && known.every((r) => headUpos(r) === 'PROPN');
    const properNoun = capitalised && (!known || onlyName || (i > 0 && readings.length === 0));
    if (readings.length === 0) {
      out.push({ ...token, reading: null, properNoun });
      prev = null;
      return;
    }
    const nextUpos = new Set<Upos>();
    for (const r of candidates[i + 1] ?? []) {
      const u = headUpos(r);
      if (u) nextUpos.add(u);
    }
    const priors = readingPriors(readings, subtlex.get(token.lower), lemmaFrequency);
    let best = 0;
    let bestScore = -1;
    readings.forEach((r, j) => {
      const score = (priors[j] ?? 0) * contextFactor(r, prev, nextUpos);
      if (score > bestScore) {
        bestScore = score;
        best = j;
      }
    });
    const reading = readings[best] ?? null;
    out.push({ ...token, reading, properNoun: false });
    prev = reading;
  });
  return out;
}
