/**
 * English glosses from Wiktextract (kaikki.org) Italian entries.
 */
import { type Upos } from './lexicon';

/** The parts of a Wiktextract JSONL entry the pipeline reads. */
export interface WiktionaryEntry {
  word: string;
  pos: string;
  senses?: { glosses?: string[]; tags?: string[] }[];
}

/** Wiktextract parts of speech acceptable for each UPOS, best first. */
export const WIKTIONARY_POS: Readonly<Record<Upos, readonly string[]>> = {
  NOUN: ['noun'],
  VERB: ['verb'],
  ADJ: ['adj'],
  ADV: ['adv'],
  PRON: ['pron'],
  DET: ['det', 'article', 'pron', 'adj'],
  ADP: ['prep', 'prep_phrase'],
  CCONJ: ['conj'],
  SCONJ: ['conj', 'adv'],
  NUM: ['num'],
  INTJ: ['intj'],
  PROPN: ['name'],
};

const SKIP_SENSE_TAGS = new Set([
  'form-of',
  'alt-of',
  'obsolete',
  'archaic',
  'dated',
  'rare',
  'poetic',
  'literary',
  'dialectal',
  'regional',
  'nonstandard',
  'misspelling',
  'abbreviation',
  'Tuscany',
  'Southern-Italy',
  'Northern-Italy',
  'Rome',
  'Naples',
  'Sicily',
]);

const OFFENSIVE_TAGS = new Set(['vulgar', 'offensive', 'derogatory', 'slur']);

/** Cleaned-up short gloss items from one Wiktionary gloss string. */
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
  // "synonym of X: meaning" keeps the meaning.
  const colon = /^(?:synonym|apocopic form|elided form|alternative form) of [^:]+: (.+)$/i.exec(
    text,
  );
  if (colon?.[1]) text = colon[1];
  if (/\b(form|plural|inflection|spelling|synonym|participle) of\b/i.test(text)) return [];
  if (/^(used|denotes|forms|indicates|expresses|the name of|name of|letter)\b/i.test(text))
    return [];
  return text
    .split(/[;,] /)
    .map((s) => s.trim().replace(/[.;:,]+$/, ''))
    .filter((s) => s.length > 0 && s.length <= 40);
}

export interface GlossResult {
  gloss: string;
  /** The first usable senses are mostly vulgar or offensive. */
  offensive: boolean;
}

/**
 * Pick a short English gloss: up to two items from the first usable sense, then
 * the first item of the next senses, at most four items and about 60 characters.
 */
export function pickGloss(entries: readonly WiktionaryEntry[], upos: Upos): GlossResult | null {
  for (const pos of WIKTIONARY_POS[upos]) {
    const senses = entries.filter((e) => e.pos === pos).flatMap((e) => e.senses ?? []);
    const usable = senses.filter((s) => !(s.tags ?? []).some((t) => SKIP_SENSE_TAGS.has(t)));
    const items: string[] = [];
    let offensiveCount = 0;
    let considered = 0;
    for (const sense of usable) {
      const senseItems = (sense.glosses ?? []).flatMap(glossItems);
      if (senseItems.length === 0) continue;
      considered++;
      if ((sense.tags ?? []).some((t) => OFFENSIVE_TAGS.has(t))) offensiveCount++;
      const take = items.length === 0 ? senseItems.slice(0, 2) : senseItems.slice(0, 1);
      for (const item of take) {
        const lower = item.toLowerCase();
        if (items.some((x) => x.toLowerCase() === lower)) continue;
        if (items.length >= 4 || [...items, item].join(', ').length > 60) break;
        items.push(item);
      }
      if (items.length >= 4 || considered >= 4) break;
    }
    if (items.length > 0) {
      return { gloss: items.join(', '), offensive: offensiveCount * 2 > considered };
    }
  }
  return null;
}
