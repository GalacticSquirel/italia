/**
 * Lemma frequencies from a word-form frequency list.
 *
 * Each form's count is shared between its lexicon readings:
 *
 * 1. across parts of speech, by SUBTLEX-IT's tag distribution for that form
 *    (a POS-tagged subtitle corpus), smoothed so unseen readings keep a little weight;
 * 2. within a part of speech (detto = dire / dettare), by SUBTLEX-IT's lemma
 *    counts when it has them, otherwise by the current estimate of each lemma's
 *    total frequency. `countLemmas` re-estimates a few times (a simple EM), so a
 *    rare homograph lemma (deviare, from "devi") cannot borrow a frequent verb's
 *    count.
 */
import { type Lexicon, lookup, type Reading, unitKey, type Upos } from './lexicon';

/** SUBTLEX-IT POS distribution for a lower-case form. */
export interface PosDistribution {
  /** Counts by SUBTLEX class (NOM, VER, ADJ, ADV, PRO, DET, PRE, CON, NUM, INT, NPR...). */
  readonly byClass: ReadonlyMap<string, number>;
  /** Counts by `CLASS-lemma`, e.g. `VER-dire`. */
  readonly byClassLemma: ReadonlyMap<string, number>;
  readonly total: number;
}

/**
 * SUBTLEX class for each part of speech. SUBTLEX-IT keeps NUM for digits and tags
 * spelled-out numbers ("tre", "sette") as adjectives, so numerals read as ADJ.
 */
export const SUBTLEX_CLASS: Readonly<Record<Upos, string>> = {
  NOUN: 'NOM',
  VERB: 'VER',
  ADJ: 'ADJ',
  ADV: 'ADV',
  PRON: 'PRO',
  DET: 'DET',
  ADP: 'PRE',
  CCONJ: 'CON',
  SCONJ: 'CON',
  NUM: 'ADJ',
  INTJ: 'INT',
  PROPN: 'NPR',
};

/**
 * Parse SUBTLEX-IT CSV text (semicolon separated, decoded from Latin-1).
 * Forms are folded to lower case; counts of capitalised spellings are merged in.
 */
export function parseSubtlex(text: string): Map<string, PosDistribution> {
  const acc = new Map<
    string,
    { byClass: Map<string, number>; byClassLemma: Map<string, number> }
  >();
  const lines = text.split(/\r?\n/);
  const header = (lines[0] ?? '').split(';');
  const formIdx = header.indexOf('wordform');
  const posIdx = header.indexOf('all_pos');
  const freqIdx = header.indexOf('all_pos_freq');
  const lemmaIdx = header.indexOf('all_pos_lemma');
  if (formIdx < 0 || posIdx < 0 || freqIdx < 0 || lemmaIdx < 0) {
    throw new Error('Unexpected SUBTLEX-IT header');
  }
  for (const line of lines.slice(1)) {
    const cols = line.split(';');
    const form = cols[formIdx]?.toLowerCase();
    const pos = cols[posIdx]?.split('.').filter(Boolean) ?? [];
    const freq = cols[freqIdx]?.split('.').filter(Boolean).map(Number) ?? [];
    const posLemma = cols[lemmaIdx]?.split('.').filter(Boolean) ?? [];
    if (!form || pos.length !== freq.length) continue;
    let dist = acc.get(form);
    if (!dist) acc.set(form, (dist = { byClass: new Map(), byClassLemma: new Map() }));
    const { byClass, byClassLemma } = dist;
    pos.forEach((p, i) => {
      const n = freq[i] ?? 0;
      if (!Number.isFinite(n)) return;
      byClass.set(p, (byClass.get(p) ?? 0) + n);
      // `VER-essere|sonare`: TreeTagger could not decide; credit each lemma.
      const pl = posLemma.length === pos.length ? posLemma[i] : undefined;
      const dash = pl?.indexOf('-') ?? -1;
      if (!pl || dash < 0) return;
      const cls = pl.slice(0, dash);
      for (const lemma of pl.slice(dash + 1).split('|')) {
        const key = `${cls}-${lemma}`;
        byClassLemma.set(key, (byClassLemma.get(key) ?? 0) + n);
      }
    });
  }
  const out = new Map<string, PosDistribution>();
  for (const [form, { byClass, byClassLemma }] of acc) {
    let total = 0;
    for (const n of byClass.values()) total += n;
    out.set(form, { byClass, byClassLemma, total });
  }
  return out;
}

/** Share of a form's SUBTLEX-IT occurrences tagged as a proper noun. */
export function properNounShare(dist: PosDistribution | undefined): number {
  if (!dist || dist.total === 0) return 0;
  return (dist.byClass.get('NPR') ?? 0) / dist.total;
}

/** Current estimate of a lemma key's total frequency (for within-class splits). */
export type LemmaFrequency = (key: string) => number;

/**
 * Prior weight of each reading of a form (sums to 1); see the module comment.
 */
export function readingPriors(
  readings: readonly Reading[],
  dist: PosDistribution | undefined,
  lemmaFrequency?: LemmaFrequency,
): number[] {
  if (readings.length === 1) return [1];
  const heads = readings.map((r) => r.units[0] ?? { lemma: '', upos: 'NOUN' as const });
  const classes = heads.map((h) => SUBTLEX_CLASS[h.upos]);
  const smoothing = dist ? dist.total * 0.01 + 1 : 1;

  // Within-class share for each reading.
  const within = heads.map((head, i) => {
    const cls = classes[i] ?? '';
    const peers = heads.filter((_, j) => classes[j] === cls);
    if (peers.length === 1) return 1;
    const subtlexCount = (h: (typeof heads)[number]) =>
      dist?.byClassLemma.get(`${cls}-${h.lemma}`) ?? 0;
    const peerSubtlex = peers.reduce((a, h) => a + subtlexCount(h), 0);
    if (peerSubtlex > 0) {
      return (subtlexCount(head) + 1) / (peerSubtlex + peers.length);
    }
    if (lemmaFrequency) {
      const f = (h: (typeof heads)[number]) => lemmaFrequency(unitKey(h)) + 1;
      return f(head) / peers.reduce((a, h) => a + f(h), 0);
    }
    return 1 / peers.length;
  });
  const raw = classes.map((c, i) => ((dist?.byClass.get(c) ?? 0) + smoothing) * (within[i] ?? 0));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => w / sum);
}

export interface FormCount {
  readonly form: string;
  readonly count: number;
}

/** Parse a FrequencyWords list (`form count` per line). */
export function parseFrequencyWords(text: string): FormCount[] {
  const out: FormCount[] = [];
  for (const line of text.split('\n')) {
    const space = line.lastIndexOf(' ');
    if (space <= 0) continue;
    const count = Number(line.slice(space + 1));
    if (Number.isFinite(count)) out.push({ form: line.slice(0, space).toLowerCase(), count });
  }
  return out;
}

export interface LemmaCounts {
  /** Weighted occurrence counts per unit key (`lemma|UPOS`). */
  readonly counts: Map<string, number>;
  /** Per-form reading weights, for corpus coverage maths. */
  readonly forms: { form: string; count: number; readings: { keys: string[]; weight: number }[] }[];
  /** All tokens in the list, including forms the lexicon does not know. */
  readonly totalTokens: number;
  readonly unknownTokens: number;
  readonly properNounTokens: number;
}

export interface CountOptions {
  /** Maps a unit key to the key it is merged into. */
  readonly canonical?: (key: string) => string;
  /** Re-estimation rounds after the first pass. */
  readonly iterations?: number;
}

function countOnce(
  formCounts: readonly FormCount[],
  lexicon: Lexicon,
  subtlex: ReadonlyMap<string, PosDistribution>,
  canonical: (key: string) => string,
  lemmaFrequency: LemmaFrequency | undefined,
): LemmaCounts {
  const counts = new Map<string, number>();
  const forms: LemmaCounts['forms'] = [];
  let totalTokens = 0;
  let unknownTokens = 0;
  let properNounTokens = 0;
  for (const { form, count } of formCounts) {
    totalTokens += count;
    const readings = lookup(lexicon, form);
    const dist = subtlex.get(form);
    if (!readings) {
      unknownTokens += count;
      continue;
    }
    if (properNounShare(dist) > 0.5) {
      properNounTokens += count;
      continue;
    }
    const priors = readingPriors(readings, dist, lemmaFrequency);
    const entry: LemmaCounts['forms'][number] = { form, count, readings: [] };
    readings.forEach((reading, i) => {
      const weight = priors[i] ?? 0;
      if (reading.units[0]?.upos === 'PROPN') {
        properNounTokens += count * weight;
        return;
      }
      const keys = reading.units.map((u) => canonical(unitKey(u)));
      entry.readings.push({ keys, weight });
      for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + count * weight);
    });
    forms.push(entry);
  }
  return { counts, forms, totalTokens, unknownTokens, properNounTokens };
}

/**
 * Accumulate lemma counts. Proper-noun readings, and forms that SUBTLEX-IT tags
 * mostly as proper nouns, are counted as proper-noun tokens instead.
 */
export function countLemmas(
  formCounts: readonly FormCount[],
  lexicon: Lexicon,
  subtlex: ReadonlyMap<string, PosDistribution>,
  { canonical = (k) => k, iterations = 3 }: CountOptions = {},
): LemmaCounts {
  let result = countOnce(formCounts, lexicon, subtlex, canonical, undefined);
  for (let i = 0; i < iterations; i++) {
    const previous = result.counts;
    result = countOnce(
      formCounts,
      lexicon,
      subtlex,
      canonical,
      (k) => previous.get(canonical(k)) ?? 0,
    );
  }
  return result;
}

/** Fraction of all tokens whose reading's lemmas are all in `known`. */
export function tokenCoverage(lemmaCounts: LemmaCounts, known: ReadonlySet<string>): number {
  let covered = 0;
  for (const form of lemmaCounts.forms) {
    for (const r of form.readings) {
      if (r.keys.every((k) => known.has(k))) covered += form.count * r.weight;
    }
  }
  return lemmaCounts.totalTokens === 0 ? 0 : covered / lemmaCounts.totalTokens;
}

/**
 * Merge lemmas that share a spelling into one entry, so the learner does not get
 * "amico (noun)" and "amico (adjective)" as separate words. Always merged: the
 * nominal classes (NOUN, ADJ, DET, PRON, NUM) with each other, and the
 * function-word classes (ADP, ADV, SCONJ, CCONJ) with each other. Any other
 * same-spelling lemma under `minShare` of the most frequent one is merged too.
 * Each group maps to its most frequent key, or to the key with the part of
 * speech given in `preferred` for that spelling.
 */
export function mergeHomographs(
  counts: ReadonlyMap<string, number>,
  {
    minShare = 0.15,
    preferred = {},
  }: { minShare?: number; preferred?: Readonly<Record<string, string>> } = {},
): (key: string) => string {
  const GROUPS: readonly (readonly Upos[])[] = [
    ['NOUN', 'ADJ', 'DET', 'PRON', 'NUM'],
    ['ADP', 'ADV', 'SCONJ', 'CCONJ'],
  ];
  const byLemma = new Map<string, { key: string; upos: string; n: number }[]>();
  for (const [key, n] of counts) {
    const [lemma = '', upos = ''] = key.split('|');
    let list = byLemma.get(lemma);
    if (!list) byLemma.set(lemma, (list = []));
    list.push({ key, upos, n });
  }
  const map = new Map<string, string>();
  for (const [lemma, list] of byLemma) {
    if (list.length < 2) continue;
    const want = preferred[lemma];
    list.sort(
      (a, b) =>
        Number(b.upos === want) - Number(a.upos === want) ||
        b.n - a.n ||
        a.key.localeCompare(b.key),
    );
    // Union-find over the entries of one spelling.
    const parent = list.map((_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i] ?? i)));
    const union = (a: number, b: number) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
    };
    const top = Math.max(...list.map((e) => e.n));
    list.forEach((e, i) => {
      if (i > 0 && e.n < top * minShare) union(0, i);
      list.forEach((f, j) => {
        if (j > i && GROUPS.some((g) => g.includes(e.upos as Upos) && g.includes(f.upos as Upos))) {
          union(i, j);
        }
      });
    });
    list.forEach((e, i) => {
      const root = list[find(i)];
      if (root && root.key !== e.key) map.set(e.key, root.key);
    });
  }
  return (key) => map.get(key) ?? key;
}

/**
 * Lemmas that exist only as a shadow of another word: more than `maxShare` of
 * their count comes from a single form whose main reading is a different lemma
 * (fallare from "fallo", stia from "stia"). Real verbs and participle adjectives
 * spread over many forms or own their main form. Only keys whose POS is in `pos`
 * are checked.
 */
export function shadowedLemmas(
  lemmaCounts: LemmaCounts,
  pos: ReadonlySet<string>,
  maxShare = 0.85,
): Set<string> {
  const best = new Map<string, { n: number; shadowed: boolean }>();
  for (const form of lemmaCounts.forms) {
    let top: (typeof form.readings)[number] | undefined;
    for (const r of form.readings) if (!top || r.weight > top.weight) top = r;
    for (const r of form.readings) {
      const key = r.keys[0];
      if (!key || !pos.has(key.split('|')[1] ?? '')) continue;
      const n = form.count * r.weight;
      const prev = best.get(key);
      if (!prev || n > prev.n) {
        best.set(key, { n, shadowed: !!top && top !== r && top.keys[0] !== key });
      }
    }
  }
  const out = new Set<string>();
  for (const [key, { n, shadowed }] of best) {
    const total = lemmaCounts.counts.get(key) ?? 0;
    if (shadowed && total > 0 && n / total > maxShare) out.add(key);
  }
  return out;
}

/**
 * Noun and adjective lemmas that are artefacts of one ambiguous form: more than
 * `maxShare` of their count comes from a single form that also reads as a
 * different word, while their own citation form is almost never used (vaio from
 * "vai", malo from "male", nullo from "nulla"). A real noun or adjective is seen
 * in its base form too.
 */
export function ghostLemmas(
  lemmaCounts: LemmaCounts,
  formCounts: readonly FormCount[],
  { maxShare = 0.85, maxOwnShare = 0.02 }: { maxShare?: number; maxOwnShare?: number } = {},
): Set<string> {
  const countOf = new Map(formCounts.map((f) => [f.form, f.count]));
  const top = new Map<string, { form: string; n: number; ambiguous: boolean }>();
  for (const f of lemmaCounts.forms) {
    for (const r of f.readings) {
      const key = r.keys[0];
      if (!key) continue;
      const n = f.count * r.weight;
      const prev = top.get(key);
      if (prev && prev.n >= n) continue;
      const lemma = key.split('|')[0];
      const ambiguous = f.readings.some((o) => o.keys[0]?.split('|')[0] !== lemma);
      top.set(key, { form: f.form, n, ambiguous });
    }
  }
  const out = new Set<string>();
  for (const [key, t] of top) {
    const [lemma = '', upos = ''] = key.split('|');
    if (upos !== 'NOUN' && upos !== 'ADJ') continue;
    if (!t.ambiguous || t.form === lemma) continue;
    const total = lemmaCounts.counts.get(key) ?? 0;
    if (total > 0 && t.n / total > maxShare && (countOf.get(lemma) ?? 0) < maxOwnShare * t.n)
      out.add(key);
  }
  return out;
}
