/**
 * The phoneme inventory used throughout `@italia/speech`, with articulatory
 * features and the substitution cost derived from them.
 *
 * Symbols are IPA, chosen for standard (neutral, Tuscan-based) Italian:
 *
 * | Class | Symbols |
 * |---|---|
 * | Vowels | `i e ɛ a ɔ o u` |
 * | Mid-vowel archiphonemes | `E` (= /e/ or /ɛ/, quality not known), `O` (= /o/ or /ɔ/) |
 * | Glides | `j w` (onset glides: *piano* /ˈpjano/, *uomo* /ˈwɔmo/) |
 * | Stops | `p b t d k ɡ` |
 * | Affricates | `ts dz tʃ dʒ` |
 * | Fricatives | `f v s z ʃ` |
 * | Nasals | `m n ɲ ŋ` (`ŋ` is the allophone of /n/ before /k ɡ/) |
 * | Liquids | `l ʎ r` |
 *
 * Consonant length is not a separate symbol: a long (geminate) consonant is
 * one phoneme with `isLong: true`. Falling-diphthong off-glides (*mai*, *poi*)
 * are written with the vowel symbols `i u` and are marked non-syllabic by the
 * G2P. Note that `ɡ` is U+0261 (IPA script g); {@link normalizePhone} maps the
 * ASCII `g` and other common recognizer spellings onto the inventory.
 *
 * @packageDocumentation
 */

/** Every phoneme symbol in the inventory. */
export const PHONEMES = [
  'i',
  'e',
  'ɛ',
  'a',
  'ɔ',
  'o',
  'u',
  'E',
  'O',
  'j',
  'w',
  'p',
  'b',
  't',
  'd',
  'k',
  'ɡ',
  'ts',
  'dz',
  'tʃ',
  'dʒ',
  'f',
  'v',
  's',
  'z',
  'ʃ',
  'm',
  'n',
  'ɲ',
  'ŋ',
  'l',
  'ʎ',
  'r',
] as const;

/** A phoneme symbol from {@link PHONEMES}. */
export type Phoneme = (typeof PHONEMES)[number];

/** Vowel height on a 1 (close) to 4 (open) scale; archiphonemes sit between close-mid and open-mid. */
export type VowelHeight = 1 | 2 | 2.5 | 3 | 4;

/** Articulatory features of a vowel. */
export interface VowelFeatures {
  readonly kind: 'vowel';
  readonly height: VowelHeight;
  readonly backness: 'front' | 'central' | 'back';
  readonly rounded: boolean;
}

/** Place of articulation, ordered front to back (the order is used as a distance). */
export const PLACES = [
  'bilabial',
  'labiodental',
  'dental',
  'postalveolar',
  'palatal',
  'velar',
] as const;

/** A place of articulation from {@link PLACES}. */
export type Place = (typeof PLACES)[number];

/** Manner of articulation. */
export type Manner =
  'stop' | 'affricate' | 'fricative' | 'nasal' | 'lateral' | 'trill' | 'approximant';

/** Articulatory features of a consonant or glide. */
export interface ConsonantFeatures {
  readonly kind: 'consonant' | 'glide';
  readonly place: Place;
  readonly manner: Manner;
  readonly voiced: boolean;
}

/** Features of any phoneme. */
export type PhonemeFeatures = VowelFeatures | ConsonantFeatures;

const v = (
  height: VowelHeight,
  backness: VowelFeatures['backness'],
  rounded: boolean,
): VowelFeatures => ({ kind: 'vowel', height, backness, rounded });
const c = (place: Place, manner: Manner, voiced: boolean): ConsonantFeatures => ({
  kind: 'consonant',
  place,
  manner,
  voiced,
});

/** Feature table for the inventory. */
export const FEATURES: Readonly<Record<Phoneme, PhonemeFeatures>> = {
  i: v(1, 'front', false),
  e: v(2, 'front', false),
  E: v(2.5, 'front', false),
  ɛ: v(3, 'front', false),
  a: v(4, 'central', false),
  ɔ: v(3, 'back', true),
  O: v(2.5, 'back', true),
  o: v(2, 'back', true),
  u: v(1, 'back', true),
  j: { kind: 'glide', place: 'palatal', manner: 'approximant', voiced: true },
  w: { kind: 'glide', place: 'velar', manner: 'approximant', voiced: true },
  p: c('bilabial', 'stop', false),
  b: c('bilabial', 'stop', true),
  t: c('dental', 'stop', false),
  d: c('dental', 'stop', true),
  k: c('velar', 'stop', false),
  ɡ: c('velar', 'stop', true),
  ts: c('dental', 'affricate', false),
  dz: c('dental', 'affricate', true),
  tʃ: c('postalveolar', 'affricate', false),
  dʒ: c('postalveolar', 'affricate', true),
  f: c('labiodental', 'fricative', false),
  v: c('labiodental', 'fricative', true),
  s: c('dental', 'fricative', false),
  z: c('dental', 'fricative', true),
  ʃ: c('postalveolar', 'fricative', false),
  m: c('bilabial', 'nasal', true),
  n: c('dental', 'nasal', true),
  ɲ: c('palatal', 'nasal', true),
  ŋ: c('velar', 'nasal', true),
  l: c('dental', 'lateral', true),
  ʎ: c('palatal', 'lateral', true),
  r: c('dental', 'trill', true),
};

const PHONEME_SET: ReadonlySet<string> = new Set(PHONEMES);

/** True if `symbol` is a phoneme of the inventory. */
export function isPhoneme(symbol: string): symbol is Phoneme {
  return PHONEME_SET.has(symbol);
}

/** True for syllabic vowels (including the archiphonemes `E` and `O`). */
export function isVowel(p: Phoneme): boolean {
  return FEATURES[p].kind === 'vowel';
}

/** True for the glides `j` and `w`. */
export function isGlide(p: Phoneme): boolean {
  return FEATURES[p].kind === 'glide';
}

/** True for consonants (not vowels, not glides). */
export function isConsonant(p: Phoneme): boolean {
  return FEATURES[p].kind === 'consonant';
}

/** Phonemes that are long whenever they stand between vowels (Italian intrinsic geminates). */
export const INTRINSIC_GEMINATES: ReadonlySet<Phoneme> = new Set<Phoneme>([
  'ʎ',
  'ɲ',
  'ʃ',
  'ts',
  'dz',
]);

/** Pairs that are allophones or near-equivalents, with a fixed low cost. */
const SPECIAL_COSTS: readonly [Phoneme, Phoneme, number][] = [
  ['n', 'ŋ', 0.1],
  ['j', 'i', 0.2],
  ['w', 'u', 0.2],
  ['ʎ', 'l', 0.4],
  ['ɲ', 'n', 0.4],
];

/** Cost of deleting an expected phoneme or inserting an extra one. */
export const INDEL_COST = 1;

/**
 * Phonetic-feature substitution cost between two inventory phonemes, in [0, 1].
 *
 * - identical: 0
 * - vowel vs vowel: `0.15 + 0.2·|Δheight| + 0.3·[backness differs] + 0.2·[rounding differs]`
 *   (`E`/`O` are half a step from their close and open variants)
 * - consonant/glide vs consonant/glide:
 *   `0.2 + 0.35·placeDistance + 0.3·[manner differs] + 0.15·[voicing differs]`,
 *   where `placeDistance` is the distance between places in {@link PLACES} divided by 5
 * - glide vs consonant gets at least 0.6, vowel vs consonant is 1
 * - a few allophone pairs (`n`/`ŋ`, `j`/`i`, `w`/`u`, `ʎ`/`l`, `ɲ`/`n`) have fixed lower costs
 *
 * All results are capped at 1 (the cost of a deletion plus an insertion is 2,
 * so a substitution is always preferred to that pair).
 */
export function substitutionCost(a: Phoneme, b: Phoneme): number {
  if (a === b) return 0;
  for (const [x, y, cost] of SPECIAL_COSTS) {
    if ((a === x && b === y) || (a === y && b === x)) return cost;
  }
  const fa = FEATURES[a];
  const fb = FEATURES[b];
  if (fa.kind === 'vowel' && fb.kind === 'vowel') {
    const cost =
      0.15 +
      0.2 * Math.abs(fa.height - fb.height) +
      (fa.backness === fb.backness ? 0 : 0.3) +
      (fa.rounded === fb.rounded ? 0 : 0.2);
    return round3(Math.min(1, cost));
  }
  if (fa.kind === 'vowel' || fb.kind === 'vowel') return 1;
  const placeDistance = Math.abs(PLACES.indexOf(fa.place) - PLACES.indexOf(fb.place)) / 5;
  let cost =
    0.2 +
    0.35 * placeDistance +
    (fa.manner === fb.manner ? 0 : 0.3) +
    (fa.voiced === fb.voiced ? 0 : 0.15);
  if (fa.kind !== fb.kind) cost = Math.max(cost, 0.6);
  return round3(Math.min(1, cost));
}

function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

/** Symbols a recognizer may emit for silence, padding or word boundaries; they are dropped. */
export const NON_SPEECH_SYMBOLS: ReadonlySet<string> = new Set([
  '',
  'sil',
  'sp',
  'spn',
  'pau',
  '<pad>',
  '<blank>',
  '<s>',
  '</s>',
  '<unk>',
  '|',
  '_',
]);

/**
 * Symbols outside the inventory that a recognizer trained on other languages
 * may emit. They are kept as-is so that the checks can recognise typical
 * learner errors (schwa, English diphthongs, aspiration).
 */
export const FOREIGN_SYMBOLS = [
  'ə',
  'ɐ',
  'ɜ',
  'ʌ',
  'ɪ',
  'ʊ',
  'ɨ',
  'æ',
  'ɑ',
  'ɒ',
  'eɪ',
  'oʊ',
  'əʊ',
  'aɪ',
  'aʊ',
  'ɔɪ',
  'ɹ',
  'ɾ',
  'θ',
  'ð',
  'h',
  'x',
  'ʒ',
] as const;

/** A recognised phone after normalisation: an inventory phoneme or a known foreign symbol. */
export type RecognizedSymbol = Phoneme | (typeof FOREIGN_SYMBOLS)[number];

const ALIASES: Readonly<Record<string, string>> = {
  g: 'ɡ',
  ʧ: 'tʃ',
  ʤ: 'dʒ',
  ʦ: 'ts',
  ʣ: 'dz',
  ts͡: 'ts',
  t͡s: 'ts',
  d͡z: 'dz',
  t͡ʃ: 'tʃ',
  d͡ʒ: 'dʒ',
  y: 'j',
  ei: 'eɪ',
  ej: 'eɪ',
  ou: 'oʊ',
  ow: 'oʊ',
  ɾ: 'r',
  ɐ: 'ə',
  ɛ̃: 'ɛ',
};

const FOREIGN_SET: ReadonlySet<string> = new Set(FOREIGN_SYMBOLS);

/** Result of {@link normalizePhone}. */
export interface NormalizedPhone {
  /** The normalised symbol, or `null` for silence/padding. */
  readonly symbol: RecognizedSymbol | null;
  /** The recognizer marked the phone long (`ː` or `:`). */
  readonly long: boolean;
  /** The recognizer marked the phone aspirated (`ʰ`). */
  readonly aspirated: boolean;
  /** The input was neither in the inventory nor a known foreign symbol. */
  readonly unknown: boolean;
}

/**
 * Map a recognizer's phone label onto the inventory: strips length (`ː`, `:`)
 * and aspiration (`ʰ`) marks into flags, applies common aliases (ASCII `g`,
 * ligature affricates, tie bars, `ɾ` → `r`) and drops silence symbols.
 * Labels that are still unknown are returned with `unknown: true` and the
 * cleaned label in `symbol` cast to the recognised type (they then match
 * nothing and cost a full substitution).
 */
export function normalizePhone(label: string): NormalizedPhone {
  let s = label.normalize('NFC').trim();
  if (NON_SPEECH_SYMBOLS.has(s.toLowerCase())) {
    return { symbol: null, long: false, aspirated: false, unknown: false };
  }
  let long = false;
  let aspirated = false;
  if (/[ː:]$/u.test(s)) {
    long = true;
    s = s.replace(/[ː:]+$/u, '');
  }
  if (s.includes('ʰ')) {
    aspirated = true;
    s = s.replace(/ʰ/gu, '');
  }
  s = ALIASES[s] ?? s;
  if (s === 'ɾ') s = 'r';
  if (isPhoneme(s) || FOREIGN_SET.has(s)) {
    return { symbol: s as RecognizedSymbol, long, aspirated, unknown: false };
  }
  return { symbol: s as RecognizedSymbol, long, aspirated, unknown: true };
}

/**
 * Substitution cost between an expected inventory phoneme and any recognised
 * symbol. Foreign symbols are costed against their nearest inventory phoneme
 * plus a small penalty (schwa-like vowels count as a mid central vowel); unknown
 * labels cost 1.
 */
export function recognizedCost(expected: Phoneme, recognized: string): number {
  if (isPhoneme(recognized)) return substitutionCost(expected, recognized);
  const nearest = FOREIGN_NEAREST[recognized];
  if (nearest === undefined) return 1;
  return Math.min(1, round3(substitutionCost(expected, nearest.phoneme) + nearest.penalty));
}

const FOREIGN_NEAREST: Readonly<Record<string, { phoneme: Phoneme; penalty: number }>> = {
  ə: { phoneme: 'E', penalty: 0.3 },
  ɜ: { phoneme: 'ɛ', penalty: 0.2 },
  ʌ: { phoneme: 'a', penalty: 0.2 },
  ɪ: { phoneme: 'i', penalty: 0.2 },
  ʊ: { phoneme: 'u', penalty: 0.2 },
  ɨ: { phoneme: 'i', penalty: 0.3 },
  æ: { phoneme: 'a', penalty: 0.2 },
  ɑ: { phoneme: 'a', penalty: 0.1 },
  ɒ: { phoneme: 'ɔ', penalty: 0.1 },
  eɪ: { phoneme: 'e', penalty: 0.3 },
  oʊ: { phoneme: 'o', penalty: 0.3 },
  əʊ: { phoneme: 'o', penalty: 0.4 },
  aɪ: { phoneme: 'a', penalty: 0.4 },
  aʊ: { phoneme: 'a', penalty: 0.4 },
  ɔɪ: { phoneme: 'ɔ', penalty: 0.4 },
  ɹ: { phoneme: 'r', penalty: 0.2 },
  ɾ: { phoneme: 'r', penalty: 0 },
  θ: { phoneme: 't', penalty: 0.3 },
  ð: { phoneme: 'd', penalty: 0.3 },
  h: { phoneme: 'k', penalty: 0.5 },
  x: { phoneme: 'k', penalty: 0.3 },
  ʒ: { phoneme: 'dʒ', penalty: 0.3 },
};
