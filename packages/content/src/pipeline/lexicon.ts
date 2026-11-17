/**
 * Morphological lexicon built from Morph-it! (form -> lemma + tag), normalised to
 * Universal POS tags and to the lemma conventions the seed uses:
 *
 * - definite articles (il, lo, la, l', i, gli, le) -> `il`; indefinite -> `un`;
 * - articulated prepositions (nel, della, sugli...) -> two units: preposition + `il`;
 * - clitics -> mi, ti, si, ci, vi, lo, la, li, le, gli, ne (me/te/se/ce/ve in
 *   clusters map to mi/ti/si/ci/vi); `glielo` -> gli + lo;
 * - verbs with enclitics (mangiarlo, dimmi) -> verb + clitic units;
 * - auxiliary, modal, causative and aspectual verb tags -> VERB.
 *
 * Pure: the build script reads the file and passes the text in.
 */

/** Universal POS tags used for seed lemmas. */
export const UPOS = [
  'NOUN',
  'VERB',
  'ADJ',
  'ADV',
  'PRON',
  'DET',
  'ADP',
  'CCONJ',
  'SCONJ',
  'NUM',
  'INTJ',
  'PROPN',
] as const;
export type Upos = (typeof UPOS)[number];

/** One lemma a surface form stands for. Key format: `lemma|UPOS`. */
export interface Unit {
  readonly lemma: string;
  readonly upos: Upos;
}

/** One reading of a surface form. Several Morph-it rows can share a reading. */
export interface Reading {
  /** Lemma units, head first (e.g. `nel` = in|ADP + il|DET). */
  readonly units: readonly Unit[];
  /** Morph-it tag heads of the rows merged into this reading, e.g. `VER`, `AUX`, `ARTPRE-M`. */
  readonly heads: readonly string[];
  /** Inflection strings of the merged rows, e.g. `ind+pres+3+s`, `part+past+s+f`. */
  readonly infl: readonly string[];
  /** Noun gender from Morph-it, when the head is a noun. */
  readonly gender?: 'm' | 'f';
}

export type Lexicon = ReadonlyMap<string, readonly Reading[]>;

export const unitKey = (u: Unit): string => `${u.lemma}|${u.upos}`;
export const readingKey = (r: Reading): string => r.units.map(unitKey).join('+');

/** Inverse of {@link unitKey}. */
export function parseUnitKey(key: string): Unit {
  const bar = key.lastIndexOf('|');
  const upos = UPOS.find((u) => u === key.slice(bar + 1));
  if (bar <= 0 || !upos) throw new Error(`Bad lemma key ${key}`);
  return { lemma: key.slice(0, bar), upos };
}

const CCONJ = new Set([
  'e',
  'ed',
  'o',
  'od',
  'oppure',
  'ma',
  'però',
  'né',
  'anzi',
  'eppure',
  'ossia',
  'ovvero',
  'bensì',
  'sia',
]);

const INDEF_ARTICLE = new Set(['un', 'uno', 'una', "un'"]);

/** Articulated-preposition prefix -> preposition lemma. Longest first. */
const ARTPRE_PREFIX: readonly (readonly [string, string])[] = [
  ['dal', 'da'],
  ['dag', 'da'],
  ['dai', 'da'],
  ['del', 'di'],
  ['deg', 'di'],
  ['dei', 'di'],
  ['nel', 'in'],
  ['neg', 'in'],
  ['nei', 'in'],
  ['sul', 'su'],
  ['sug', 'su'],
  ['sui', 'su'],
  ['al', 'a'],
  ['ag', 'a'],
  ['ai', 'a'],
  ['col', 'con'],
  ['cog', 'con'],
  ['coi', 'con'],
  ['pel', 'per'],
  ['pei', 'per'],
];

const CLITIC_CANON: Readonly<Record<string, string>> = {
  mi: 'mi',
  me: 'mi',
  "m'": 'mi',
  ti: 'ti',
  te: 'ti',
  "t'": 'ti',
  si: 'si',
  se: 'si',
  "s'": 'si',
  ci: 'ci',
  ce: 'ci',
  "c'": 'ci',
  vi: 'vi',
  ve: 'vi',
  "v'": 'vi',
  lo: 'lo',
  la: 'la',
  li: 'li',
  le: 'le',
  gli: 'gli',
  glie: 'gli',
  ne: 'ne',
  "n'": 'ne',
};

/** Clitic strings that can end a verb tag (`inf+pres+lo`, `impr+pres+2+s+melo`). */
const ENCLITIC_PIECES = [
  'glie',
  'gli',
  'me',
  'te',
  'se',
  'ce',
  've',
  'mi',
  'ti',
  'si',
  'ci',
  'vi',
  'lo',
  'la',
  'li',
  'le',
  'ne',
];

/** Split a clitic cluster such as `melo` or `gliene` into canonical clitic lemmas. */
export function splitClitics(cluster: string): string[] | null {
  if (cluster === '') return [];
  for (const piece of ENCLITIC_PIECES) {
    if (cluster.startsWith(piece)) {
      const rest = splitClitics(cluster.slice(piece.length));
      const canon = CLITIC_CANON[piece];
      if (rest && canon) return [canon, ...rest];
    }
  }
  return null;
}

const pron = (lemma: string): Unit => ({ lemma, upos: 'PRON' });

function artpre(form: string): Unit[] {
  const lower = form.toLowerCase();
  for (const [prefix, prep] of ARTPRE_PREFIX) {
    if (lower.startsWith(prefix))
      return [
        { lemma: prep, upos: 'ADP' },
        { lemma: 'il', upos: 'DET' },
      ];
  }
  return [{ lemma: form, upos: 'ADP' }];
}

/** Morph-it lists "dimmi", "fallo" etc. with themselves as lemma; recover the verb. */
const SHORT_IMPERATIVES: readonly (readonly [string, string])[] = [
  ['sta', 'stare'],
  ['di', 'dire'],
  ['da', 'dare'],
  ['fa', 'fare'],
  ['va', 'andare'],
];

function shortImperativeVerb(form: string): string | undefined {
  return SHORT_IMPERATIVES.find(([prefix]) => form.startsWith(prefix))?.[1];
}

interface Row {
  units: Unit[];
  head: string;
  infl: string;
  gender?: 'm' | 'f';
}

/** Normalise one Morph-it row; null for punctuation, symbols, abbreviations. */
export function normaliseRow(form: string, lemma: string, tag: string): Row | null {
  const colon = tag.indexOf(':');
  const head = colon === -1 ? tag : tag.slice(0, colon);
  const infl = colon === -1 ? '' : tag.slice(colon + 1);
  const major = head.split('-')[0] ?? head;
  const one = (upos: Upos, l = lemma): Row => ({ units: [{ lemma: l, upos }], head, infl });

  switch (major) {
    case 'NOUN':
      return { ...one('NOUN'), gender: head.endsWith('-F') ? 'f' : 'm' };
    case 'ADJ':
      return one('ADJ');
    case 'VER':
    case 'AUX':
    case 'MOD':
    case 'CAU':
    case 'ASP': {
      const parts = infl.split('+');
      const last = parts.at(-1) ?? '';
      const clitics = /^[a-z]{2,}$/.test(last) ? splitClitics(last) : null;
      const units: Unit[] = [
        {
          lemma: lemma === form && clitics ? (shortImperativeVerb(form) ?? lemma) : lemma,
          upos: 'VERB',
        },
      ];
      if (clitics && clitics.length > 0) units.push(...clitics.map(pron));
      return { units, head, infl };
    }
    case 'ADV':
      return form === "c'" ? { units: [pron('ci')], head: 'CI', infl } : one('ADV');
    case 'PRE':
      return one('ADP');
    case 'ARTPRE':
      return { units: artpre(form), head, infl };
    case 'ART': {
      if (INDEF_ARTICLE.has(form)) return one('DET', 'un');
      if (/^de(l|i|g)/.test(form)) return { units: artpre(form), head: 'ARTPRE', infl };
      return one('DET', 'il');
    }
    case 'DET':
      if (head === 'DET-NUM-CARD') return one('NUM');
      return one('DET');
    case 'TALE':
      return one('DET');
    case 'PRO': {
      if (head === 'PRO-NUM') return one('NUM');
      if (head === 'PRO-PERS-CLI-COM') {
        const base = lemma.replace(/'$/, 'o');
        const pieces = splitClitics(base);
        return pieces ? { units: pieces.map(pron), head, infl } : null;
      }
      if (head.startsWith('PRO-PERS-CLI')) {
        if (form === "l'") return { units: [pron(head.includes('-F-') ? 'la' : 'lo')], head, infl };
        // Stressed "me"/"te" also appear as clitic rows; the PRO-PERS rows keep them.
        const canon = CLITIC_CANON[form] ?? lemma;
        return { units: [pron(canon)], head, infl };
      }
      if (head.startsWith('PRO-PERS')) return one('PRON', lemma === 'sè' ? 'sé' : lemma);
      return one('PRON');
    }
    case 'CE':
    case 'CI':
      return { units: [pron('ci')], head, infl };
    case 'NE':
      return { units: [pron('ne')], head, infl };
    case 'SI':
      return { units: [pron('si')], head, infl };
    case 'CON':
      return one(CCONJ.has(lemma) ? 'CCONJ' : 'SCONJ');
    case 'WH':
      return one('ADV');
    case 'INT':
      return one('INTJ');
    case 'NPR':
      return one('PROPN');
    default:
      return null;
  }
}

/**
 * Morph-it! lists demonstrative, possessive and indefinite pronouns under their
 * inflected form ("mia", "questa", "altri"), while the determiner rows of the same
 * form carry the base lemma (mio, questo, altro). Give such a pronoun the
 * determiner's lemma so both count towards one word.
 */
function normalisePronounLemmas(
  form: string,
  readings: Map<string, { units: Unit[]; heads: Set<string>; infl: Set<string> }>,
): void {
  const detLemmas = new Set<string>();
  for (const r of readings.values()) {
    const u = r.units[0];
    if (r.units.length === 1 && u?.upos === 'DET' && [...r.heads].some((h) => h.startsWith('DET-')))
      detLemmas.add(u.lemma);
  }
  const [base] = detLemmas;
  if (detLemmas.size !== 1 || !base || base === form) return;
  for (const [key, r] of [...readings]) {
    const u = r.units[0];
    const pronoun =
      r.units.length === 1 &&
      u?.upos === 'PRON' &&
      u.lemma === form &&
      [...r.heads].every((h) => h.startsWith('PRO-') && !h.startsWith('PRO-PERS'));
    if (!pronoun) continue;
    readings.delete(key);
    const units: Unit[] = [{ lemma: base, upos: 'PRON' }];
    const newKey = units.map(unitKey).join('+');
    const existing = readings.get(newKey);
    if (existing) {
      for (const h of r.heads) existing.heads.add(h);
      for (const i of r.infl) existing.infl.add(i);
    } else readings.set(newKey, { ...r, units });
  }
}

/** Parse Morph-it text (`form<TAB>lemma<TAB>tag` per line, already decoded). */
export function parseMorphIt(text: string): Map<string, Reading[]> {
  interface Acc {
    units: Unit[];
    heads: Set<string>;
    infl: Set<string>;
    gender?: 'm' | 'f';
  }
  const byForm = new Map<string, Map<string, Acc>>();
  for (const line of text.split('\n')) {
    const [rawForm, lemma, tag] = line.trim().split('\t');
    if (!rawForm || !lemma || !tag) continue;
    const form = rawForm.toLowerCase();
    if (/\d/.test(form)) continue;
    const row = normaliseRow(form, lemma, tag);
    if (!row) continue;
    const key = row.units.map(unitKey).join('+');
    let readings = byForm.get(form);
    if (!readings) byForm.set(form, (readings = new Map<string, Acc>()));
    const existing = readings.get(key);
    if (existing) {
      existing.heads.add(row.head);
      if (row.infl) existing.infl.add(row.infl);
    } else {
      readings.set(key, {
        units: row.units,
        heads: new Set([row.head]),
        infl: new Set(row.infl ? [row.infl] : []),
        ...(row.gender ? { gender: row.gender } : {}),
      });
    }
  }
  for (const [form, readings] of byForm) normalisePronounLemmas(form, readings);
  const out = new Map<string, Reading[]>();
  for (const [form, readings] of byForm) {
    out.set(
      form,
      [...readings.values()].map((r) => ({
        units: r.units,
        heads: [...r.heads].sort(),
        infl: [...r.infl].sort(),
        ...(r.gender ? { gender: r.gender } : {}),
      })),
    );
  }
  return out;
}

/**
 * Restrict some forms to one reading (see `FORM_READINGS` in overrides). A forced
 * reading the lexicon lacks is added as a bare single-unit reading.
 */
export function applyFormReadings(
  lexicon: Map<string, Reading[]>,
  forced: Readonly<Record<string, string>>,
): void {
  for (const [form, key] of Object.entries(forced)) {
    const existing = (lexicon.get(form) ?? []).filter((r) => readingKey(r) === key);
    if (existing.length > 0) {
      lexicon.set(form, existing);
      continue;
    }
    const [lemma = '', upos = ''] = key.split('|');
    const known = UPOS.find((u) => u === upos);
    if (!known) throw new Error(`Bad override ${key}`);
    lexicon.set(form, [{ units: [{ lemma, upos: known }], heads: ['OVERRIDE'], infl: [] }]);
  }
}

const ACCENTED: Readonly<Record<string, string[]>> = {
  a: ['à'],
  e: ['è', 'é'],
  i: ['ì'],
  o: ['ò'],
  u: ['ù'],
};

/**
 * Look a lower-case form up, trying the spellings subtitles and casual typing use:
 * `po` for `po'`, `perche`/`perche'` for `perché`, `e'` for `è`.
 */
export function lookup(lexicon: Lexicon, form: string): readonly Reading[] | undefined {
  const direct = lexicon.get(form);
  if (!direct) return lookupVariant(lexicon, form);
  // "po", "gia", "sara" are also names; keep the common-word spelling as well.
  if (direct.every((r) => r.units[0]?.upos === 'PROPN')) {
    const variant = lookupVariant(lexicon, form);
    if (variant) return [...variant, ...direct];
  }
  return direct;
}

function lookupVariant(lexicon: Lexicon, form: string): readonly Reading[] | undefined {
  const withApostrophe = lexicon.get(`${form}'`);
  if (withApostrophe) return withApostrophe;
  // A final apostrophe after a vowel is usually a typed accent (e' = è); otherwise
  // it is a closing quote.
  const bare = form.endsWith("'") ? form.slice(0, -1) : form;
  const last = bare.at(-1);
  if (last && ACCENTED[last]) {
    for (const accented of ACCENTED[last]) {
      const hit = lexicon.get(bare.slice(0, -1) + accented);
      if (hit) return hit;
    }
  }
  return bare !== form ? lexicon.get(bare) : undefined;
}

/**
 * Remove readings whose first unit is one of `keys` from every form that has
 * another reading left (see `ghostLemmas`).
 */
export function dropReadings(lexicon: Map<string, Reading[]>, keys: ReadonlySet<string>): void {
  for (const [form, readings] of lexicon) {
    const kept = readings.filter((r) => !(r.units[0] && keys.has(unitKey(r.units[0]))));
    if (kept.length > 0 && kept.length < readings.length) lexicon.set(form, kept);
  }
}
