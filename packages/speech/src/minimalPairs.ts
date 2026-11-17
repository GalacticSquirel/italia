/**
 * Curated Italian minimal pairs for high-variability phonetic training (HVPT)
 * and minimal-pair production drills, with English glosses.
 *
 * Three contrasts:
 *
 * - **geminate**: single vs long consonant (*caro* vs *carro*). Some pairs also
 *   differ, in standard Italian, in the quality of the stressed mid vowel
 *   (*séte* vs *sètte*) or, in northern speech, in the voicing of the single
 *   `s` (*casa* [ˈkaːza] / *cassa*); these are marked in `alsoDiffers` so a drill
 *   can avoid them when it needs a pure length contrast.
 * - **midVowel**: open vs close *e* and *o* (*pèsca* vs *pésca*). Only well-established
 *   pairs of the standard (Tuscan-based) norm are listed; all are marked
 *   `regionalVariance` because many speakers, especially in the north and
 *   south, distribute open and close vowels differently or do not contrast them.
 * - **stress**: the same letters with stress on different syllables
 *   (*àncora* vs *ancóra*).
 *
 * @packageDocumentation
 */

/** One word of a minimal set. */
export interface MinimalPairItem {
  /** Normal spelling (with an accent only where Italian spelling requires one). */
  readonly word: string;
  /**
   * Teaching spelling with stress and, for e/o, quality marked (`è ò` open,
   * `é ó` close). For geminate pairs it equals `word` (penultimate stress).
   */
  readonly accented: string;
  /** English gloss. */
  readonly gloss: string;
}

/** The contrast a set trains. */
export type MinimalPairContrast = 'geminate' | 'midVowel' | 'stress';

/** Secondary differences inside a geminate pair. */
export type SecondaryDifference = 'midVowelQuality' | 'sVoicing';

/** A minimal pair (or triple, for stress). */
export interface MinimalPairSet {
  readonly contrast: MinimalPairContrast;
  readonly items: readonly MinimalPairItem[];
  /** Other differences between the items besides the trained contrast. */
  readonly alsoDiffers: readonly SecondaryDifference[];
  /** The contrast is not made, or made differently, in some regional standards. */
  readonly regionalVariance: boolean;
}

type Row = readonly [string, string, string, string];

const item = (word: string, accented: string, gloss: string): MinimalPairItem => ({
  word,
  accented,
  gloss,
});

/** [single, single gloss, double, double gloss]; the stress is penultimate in all of them. */
const GEMINATE_ROWS: readonly (readonly [...Row, readonly SecondaryDifference[]])[] = [
  ['caro', 'dear', 'carro', 'cart', []],
  ['pala', 'shovel', 'palla', 'ball', []],
  ['fato', 'fate', 'fatto', 'done, made; fact', []],
  ['nono', 'ninth', 'nonno', 'grandfather', []],
  ['sete', 'thirst', 'sette', 'seven', ['midVowelQuality']],
  ['copia', 'copy', 'coppia', 'couple, pair', []],
  ['pena', 'pain, penalty', 'penna', 'pen; feather', []],
  ['casa', 'house', 'cassa', 'till, cash desk; crate', ['sVoicing']],
  ['tufo', 'tuff (volcanic rock)', 'tuffo', 'dive', []],
  ['sono', '(I) am; (they) are', 'sonno', 'sleep, sleepiness', []],
  ['papa', 'pope', 'pappa', 'baby food, mush', []],
  ['capello', '(a single) hair', 'cappello', 'hat', ['midVowelQuality']],
  ['camino', 'fireplace, chimney', 'cammino', 'path, journey', []],
  ['note', 'notes', 'notte', 'night', []],
  ['bruto', 'brute', 'brutto', 'ugly', []],
  ['dita', 'fingers', 'ditta', 'firm, company', []],
  ['tuta', 'tracksuit, overalls', 'tutta', 'all, whole (fem.)', []],
  ['fumo', 'smoke', 'fummo', 'we were (past historic)', []],
  ['cane', 'dog', 'canne', 'reeds, canes', []],
  ['sano', 'healthy', 'sanno', '(they) know', []],
  ['speso', 'spent', 'spesso', 'often; thick', ['sVoicing']],
  ['vano', 'vain; room, space', 'vanno', '(they) go', []],
  ['fata', 'fairy', 'fatta', 'made, done (fem.)', []],
  ['bara', 'coffin', 'barra', 'bar, rod', []],
  ['sera', 'evening', 'serra', 'greenhouse', ['midVowelQuality']],
  ['steso', 'spread out, hung out', 'stesso', 'same', ['sVoicing']],
  ['nona', 'ninth (fem.)', 'nonna', 'grandmother', []],
  ['beve', '(he/she) drinks', 'bevve', '(he/she) drank', []],
  ['cade', '(it) falls', 'cadde', '(it) fell', []],
  ['vene', 'veins', 'venne', '(he/she) came', []],
  ['bela', '(it) bleats', 'bella', 'beautiful (fem.)', []],
  ['dona', '(he/she) gives, donates', 'donna', 'woman', []],
  ['seta', 'silk', 'setta', 'sect', []],
  ['ano', 'anus', 'anno', 'year', []],
  ['base', 'base, basis', 'basse', 'low (fem. pl.)', ['sVoicing']],
  ['rise', '(he/she) laughed', 'risse', 'brawls', ['sVoicing']],
  ['coro', 'choir', 'corro', 'I run', ['midVowelQuality']],
  ['faro', 'lighthouse', 'farro', 'spelt (grain)', []],
  ['mira', 'aim', 'mirra', 'myrrh', []],
  ['seno', 'breast, bosom', 'senno', 'good sense, judgement', []],
  ['pani', 'loaves', 'panni', 'clothes, cloths', []],
  ['mete', 'goals, destinations', 'mette', '(he/she) puts', ['midVowelQuality']],
  ['fate', 'fairies', 'fatte', 'made, done (fem. pl.)', []],
  ['dite', '(you pl.) say', 'ditte', 'firms, companies', []],
  ['polo', 'pole (geography); polo shirt', 'pollo', 'chicken', ['midVowelQuality']],
  ['tono', 'tone', 'tonno', 'tuna', ['midVowelQuality']],
  ['moto', 'motion; motorbike', 'motto', 'motto, saying', ['midVowelQuality']],
  ['tori', 'bulls', 'torri', 'towers', ['midVowelQuality']],
  ['cori', 'choirs', 'corri', '(you) run', ['midVowelQuality']],
  ['vale', '(it) is worth', 'valle', 'valley', []],
  ['eco', 'echo', 'ecco', 'here is, there is', []],
];

/** [open, open gloss, close, close gloss], in teaching spelling. */
const MID_VOWEL_ROWS: readonly Row[] = [
  ['pèsca', 'peach', 'pésca', 'fishing'],
  ['bòtte', 'blows, beating', 'bótte', 'barrel, cask'],
  ['vènti', 'winds', 'vénti', 'twenty'],
  ['fòro', 'forum; law court', 'fóro', 'hole'],
  ['ròsa', 'rose; pink', 'rósa', 'gnawed, eroded'],
  ['tèma', 'theme, essay', 'téma', 'fear (literary)'],
  ['lègge', '(he/she) reads', 'légge', 'law'],
  ['affètto', 'affection', 'affétto', 'I slice'],
  ['scòpo', 'aim, purpose', 'scópo', 'I sweep'],
  ['mènte', '(he/she) lies', 'ménte', 'mind'],
];

/** Stress sets: [normal spelling, teaching spelling, gloss] per item. */
const STRESS_SETS: readonly (readonly (readonly [string, string, string])[])[] = [
  [
    ['ancora', 'àncora', 'anchor'],
    ['ancora', 'ancóra', 'still, again'],
  ],
  [
    ['principi', 'prìncipi', 'princes'],
    ['principi', 'princìpi', 'principles'],
  ],
  [
    ['capito', 'càpito', 'I happen (to be somewhere)'],
    ['capito', 'capìto', 'understood'],
    ['capitò', 'capitò', '(it) happened'],
  ],
  [
    ['subito', 'sùbito', 'immediately'],
    ['subito', 'subìto', 'suffered, undergone'],
  ],
  [
    ['intuito', 'intùito', 'intuition'],
    ['intuito', 'intuìto', 'intuited, sensed'],
  ],
  [
    ['papa', 'pàpa', 'pope'],
    ['papà', 'papà', 'dad'],
  ],
  [
    ['abito', 'àbito', 'dress, suit; I live'],
    ['abitò', 'abitò', '(he/she) lived'],
  ],
  [
    ['parlo', 'pàrlo', 'I speak'],
    ['parlò', 'parlò', '(he/she) spoke'],
  ],
  [
    ['auguri', 'àuguri', 'augurs'],
    ['auguri', 'augùri', 'best wishes'],
  ],
  [
    ['arbitro', 'àrbitro', 'referee'],
    ['arbitro', 'arbìtro', 'I arbitrate'],
  ],
  [
    ['leggere', 'lèggere', 'to read'],
    ['leggere', 'leggère', 'light (fem. pl.)'],
  ],
  [
    ['meta', 'mèta', 'goal, destination'],
    ['metà', 'metà', 'half'],
  ],
];

/** All minimal sets, geminate first, then mid vowel, then stress. */
export const MINIMAL_PAIRS: readonly MinimalPairSet[] = [
  ...GEMINATE_ROWS.map(([a, ga, b, gb, also]): MinimalPairSet => ({
    contrast: 'geminate',
    items: [item(a, a, ga), item(b, b, gb)],
    alsoDiffers: also,
    regionalVariance: false,
  })),
  ...MID_VOWEL_ROWS.map(([a, ga, b, gb]): MinimalPairSet => ({
    contrast: 'midVowel',
    items: [
      item(a.normalize('NFD').replace(/[̀́]/gu, '').normalize('NFC'), a, ga),
      item(b.normalize('NFD').replace(/[̀́]/gu, '').normalize('NFC'), b, gb),
    ],
    alsoDiffers: [],
    regionalVariance: true,
  })),
  ...STRESS_SETS.map((set): MinimalPairSet => ({
    contrast: 'stress',
    items: set.map(([w, acc, g]) => item(w, acc, g)),
    alsoDiffers: [],
    regionalVariance: false,
  })),
];

/** The minimal sets for one contrast. */
export function minimalPairsFor(contrast: MinimalPairContrast): MinimalPairSet[] {
  return MINIMAL_PAIRS.filter((set) => set.contrast === contrast);
}
