/**
 * English glosses from Wiktextract (kaikki.org) Italian entries.
 */
import { type Upos } from './lexicon';

/** The parts of a Wiktextract JSONL entry the pipeline reads. */
export interface WiktionaryEntry {
  word: string;
  pos: string;
  senses?: {
    glosses?: string[];
    tags?: string[];
    alt_of?: { word: string }[];
    form_of?: { word: string }[];
  }[];
}

/** Wiktextract parts of speech acceptable for each UPOS, best first. */
export const WIKTIONARY_POS: Readonly<Record<Upos, readonly string[]>> = {
  NOUN: ['noun'],
  VERB: ['verb'],
  ADJ: ['adj'],
  ADV: ['adv', 'particle'],
  PRON: ['pron'],
  DET: ['det', 'article', 'pron', 'adj'],
  ADP: ['prep', 'prep_phrase'],
  CCONJ: ['conj'],
  SCONJ: ['conj', 'adv'],
  NUM: ['num'],
  INTJ: ['intj'],
  PROPN: ['name'],
};

/** Wiktextract parts of speech never used as a fallback. */
const NEVER_POS = new Set(['name', 'suffix', 'prefix', 'infix', 'character', 'symbol', 'phrase']);

const SKIP_SENSE_TAGS = new Set([
  'obsolete',
  'archaic',
  'dated',
  'poetic',
  'literary',
  'historical',
  'dialectal',
  'regional',
  'nonstandard',
  'misspelling',
  'Tuscany',
  'Southern-Italy',
  'Northern-Italy',
  'Rome',
  'Naples',
  'Sicily',
]);

/** Sense tags marking a pointer to another word rather than a meaning of its own. */
const POINTER_TAGS = new Set(['form-of', 'alt-of']);

const OFFENSIVE_TAGS = new Set(['vulgar', 'offensive', 'derogatory', 'slur']);

const FORM_OF =
  /\b(?:form|plural|inflection|spelling|synonym|participle|prepositional|dative) of\b/i;
const USAGE_NOTE = /^(?:used|denotes|forms|indicates|expresses|the name of|name of|letter)\b/i;

/**
 * Cleaned-up short gloss items from one Wiktionary gloss string. Usage notes and
 * "form of X" pointers are dropped, but a meaning after a colon is kept
 * ("prepositional of che: whom, which" -> whom, which).
 */
export function glossItems(gloss: string): string[] {
  let text = gloss;
  // Strip nested parentheses from the inside out.
  for (let previous = ''; previous !== text;) {
    previous = text;
    text = text.replace(/\([^()]*\)/g, '');
  }
  text = text
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const colon = /^[^:]* of [^:]+: (.+)$/i.exec(text);
  if (colon?.[1]) text = colon[1];
  return text
    .split(/; /)
    .filter((segment) => !FORM_OF.test(segment) && !USAGE_NOTE.test(segment.trim()))
    .flatMap((segment) => segment.split(/, /))
    .map((s) => s.trim().replace(/[.;:,]+$/, ''))
    .filter((s) => s.length > 0 && s.length <= 40);
}

export interface GlossResult {
  gloss: string;
  /** The first usable senses are mostly vulgar or offensive. */
  offensive: boolean;
}

type Sense = NonNullable<WiktionaryEntry['senses']>[number];

function glossFromSenses(
  senses: readonly Sense[],
  ignoreTags: ReadonlySet<string>,
): GlossResult | null {
  const items: string[] = [];
  let offensiveCount = 0;
  let considered = 0;
  for (const sense of senses) {
    const tags = sense.tags ?? [];
    if (tags.some((t) => SKIP_SENSE_TAGS.has(t) && !ignoreTags.has(t))) continue;
    // A pointer sense ("inflection of portare:", "dative of che: to whom") only
    // contributes the meaning after its colon.
    const pointer = tags.some((t) => POINTER_TAGS.has(t));
    const senseItems = (sense.glosses ?? [])
      .filter((g) => !pointer || / of [^:]+: \S/.test(g))
      .flatMap(glossItems);
    if (senseItems.length === 0) continue;
    considered++;
    if (tags.some((t) => OFFENSIVE_TAGS.has(t))) offensiveCount++;
    const take = items.length === 0 ? senseItems.slice(0, 2) : senseItems.slice(0, 1);
    for (const item of take) {
      const lower = item.toLowerCase();
      if (items.some((x) => x.toLowerCase() === lower)) continue;
      if (items.length >= 4 || [...items, item].join(', ').length > 60) break;
      items.push(item);
    }
    if (items.length >= 4 || considered >= 4) break;
  }
  return items.length > 0
    ? { gloss: items.join(', '), offensive: offensiveCount * 2 > considered }
    : null;
}

/**
 * Pick a short English gloss for a lemma: up to two items from the first usable
 * sense, then the first item of the next senses (at most four items, about 60
 * characters). Entries for the POS of `upos` are tried first; with `anyPos`, any
 * other part of speech is tried after them.
 */
export function pickGloss(
  entries: readonly WiktionaryEntry[],
  upos: Upos,
  { anyPos = false }: { anyPos?: boolean } = {},
): GlossResult | null {
  const preferred = WIKTIONARY_POS[upos];
  const order = anyPos
    ? [
        ...preferred,
        ...[...new Set(entries.map((e) => e.pos))].filter(
          (p) => !preferred.includes(p) && !NEVER_POS.has(p),
        ),
      ]
    : preferred;
  for (const pos of order) {
    const result = glossFromSenses(senses(pos), new Set());
    if (result) return result;
  }
  // Some entries carry a register tag on every sense ("gente" is all archaic and
  // poetic): such entry-wide tags do not mark one sense as unusual.
  for (const pos of preferred) {
    const list = senses(pos);
    const [first, ...rest] = list.map((s) => new Set(s.tags ?? []));
    // One sense alone cannot show that its tag is entry-wide.
    if (!first || rest.length === 0) continue;
    const common = new Set([...first].filter((t) => rest.every((tags) => tags.has(t))));
    const result = glossFromSenses(list, common);
    if (result) return result;
  }
  return null;

  function senses(pos: string): Sense[] {
    return entries.filter((e) => e.pos === pos).flatMap((e) => e.senses ?? []);
  }
}

const POINTER_GLOSS = /^(?:[\w-]+,? )*(?:form|spelling) of ([\p{L}']+)/iu;

/**
 * If a word is only a variant spelling of another word (apocopic "buon" of buono,
 * euphonic "ed" of e, "po'" of poco), return that word. Every non-name entry must
 * open with such a pointer; the entry for one of `posOrder` decides the target.
 */
export function variantOf(
  entries: readonly WiktionaryEntry[],
  posOrder: readonly string[] = [],
): string | null {
  const relevant = entries.filter((e) => !NEVER_POS.has(e.pos));
  if (relevant.length === 0) return null;
  const targetOf = (entry: WiktionaryEntry): string | null => {
    const first = entry.senses?.[0];
    if (!first) return null;
    // Wiktextract sometimes keeps trailing words ("a for euphony").
    const pointer = /^[\p{L}']+/u.exec(
      first.alt_of?.[0]?.word ?? first.form_of?.[0]?.word ?? '',
    )?.[0];
    const tags = first.tags ?? [];
    const variantTag = tags.some((t) => ['apocopic', 'alternative', 'elided'].includes(t));
    if (pointer && tags.some((t) => POINTER_TAGS.has(t)) && variantTag) return pointer;
    const gloss = first.glosses?.[0] ?? '';
    const m = POINTER_GLOSS.exec(gloss);
    if (m?.[1] && /\b(?:apocopic|alternative|elided|preconsonantal|prevocalic)\b/i.test(gloss))
      return m[1];
    return null;
  };
  const targets = relevant.map(targetOf);
  if (targets.some((t) => t === null)) return null;
  const preferred = relevant.findIndex((e) => posOrder.includes(e.pos));
  const target = targets[preferred >= 0 ? preferred : 0] ?? null;
  return target && target !== relevant[0]?.word ? target : null;
}
