/**
 * Simple pattern rules that detect which grammar points a tagged sentence uses,
 * so the app can avoid showing a sentence before its grammar is unlocked.
 * Rules aim for precision on the common patterns; they are not a parser.
 */
import { GRAMMAR_POINTS } from './points';
import { type Reading } from '../pipeline/lexicon';
import { hasInfl, isVerb, type TaggedToken } from '../pipeline/tagger';

const IRREGULAR_PRESENT = new Set([
  'fare',
  'andare',
  'stare',
  'dare',
  'venire',
  'dire',
  'uscire',
  'sapere',
  'bere',
  'rimanere',
  'tenere',
  'salire',
  'scegliere',
  'sedere',
  'morire',
  'porre',
  'tradurre',
  'piacere',
  'cogliere',
  'togliere',
  'spegnere',
  'apparire',
  'parere',
  'tacere',
  'valere',
  'udire',
]);
const MODALS = new Set(['volere', 'potere', 'dovere']);
const AUX = new Set(['essere', 'avere']);
const REFLEXIVE_CLITICS: Readonly<Record<string, string>> = {
  mi: '1+s',
  ti: '2+s',
  si: '3',
  ci: '1+p',
  vi: '2+p',
};
const DIRECT_3RD = new Set(['lo', 'la', 'li', 'le']);
const INDIRECT_VERBS = new Set([
  'dare',
  'dire',
  'telefonare',
  'scrivere',
  'chiedere',
  'rispondere',
  'mandare',
  'piacere',
  'portare',
  'regalare',
  'spiegare',
  'parlare',
  'prestare',
  'mostrare',
  'offrire',
  'fare',
]);
const BETWEEN_AUX_AND_PARTICIPLE = new Set([
  'già',
  'mai',
  'appena',
  'sempre',
  'ancora',
  'anche',
  'non',
  'più',
  'proprio',
  'davvero',
  'veramente',
  'bene',
  'male',
  'molto',
  'tanto',
  'poi',
  'subito',
  'tutto',
  'tutti',
]);
const SUBJECT_PRONOUNS = new Set(['io', 'tu', 'lui', 'lei', 'noi', 'voi', 'loro']);
const POSSESSIVES = new Set(['mio', 'tuo', 'suo', 'nostro', 'vostro', 'loro']);

const idBySlug = new Map(GRAMMAR_POINTS.map((p) => [p.slug, p.id]));

/** Grammar point id for a slug (throws on typos). */
export function grammarId(slug: string): number {
  const id = idBySlug.get(slug);
  if (id === undefined) throw new Error(`Unknown grammar slug ${slug}`);
  return id;
}

const lemma = (r: Reading | null): string | undefined => r?.units[0]?.lemma;
const upos = (r: Reading | null) => r?.units[0]?.upos;
const hasUnit = (r: Reading | null, l: string, u: string) =>
  !!r && r.units.some((x) => x.lemma === l && x.upos === u);
const isArticleHead = (r: Reading | null) => !!r && r.heads.some((h) => h.startsWith('ART-'));
const isArtpre = (r: Reading | null) => !!r && r.heads.some((h) => h.startsWith('ARTPRE'));
const finitePresent = (r: Reading | null) => hasInfl(r, 'ind+pres');
const isParticiple = (r: Reading | null) => isVerb(r) && hasInfl(r, 'part+past');
const isClitic = (
  r: Reading | null,
  set: ReadonlySet<string> | Readonly<Record<string, string>>,
) => {
  const l = lemma(r);
  return upos(r) === 'PRON' && !!l && (set instanceof Set ? set.has(l) : l in set);
};

/** Person+number of a finite reading, e.g. "1+s", from `ind+pres+1+s`. */
function persons(r: Reading | null): string[] {
  if (!r) return [];
  return r.infl
    .map((i) => i.split('+'))
    .filter((p) => p.length >= 4 && /^[123]$/.test(p[2] ?? ''))
    .map((p) => `${p[2] ?? ''}+${p[3] ?? ''}`);
}

const personMatches = (clitic: string, r: Reading | null) => {
  const want = REFLEXIVE_CLITICS[clitic];
  return !!want && persons(r).some((p) => p.startsWith(want));
};

function regularParticiple(verb: string): string | null {
  if (verb.endsWith('are')) return `${verb.slice(0, -3)}at`;
  if (verb.endsWith('ere')) return `${verb.slice(0, -3)}ut`;
  if (verb.endsWith('ire')) return `${verb.slice(0, -3)}it`;
  return null;
}

/** Index of a past participle following position i (skipping a few adverbs), or -1. */
function participleAfter(tokens: readonly TaggedToken[], i: number): number {
  for (let j = i + 1; j < tokens.length && j <= i + 3; j++) {
    const t = tokens[j];
    if (!t) break;
    if (isParticiple(t.reading)) return j;
    if (!BETWEEN_AUX_AND_PARTICIPLE.has(t.lower)) break;
  }
  return -1;
}

/** Detect grammar points used by a tagged sentence. Returns sorted ids. */
export function detectGrammar(sentence: string, tokens: readonly TaggedToken[]): number[] {
  const found = new Set<string>();
  const add = (slug: string) => found.add(slug);
  const seen = { passato: false, imperfetto: false };
  // Participles after essere/avere ("sono andate") are not present-tense forms.
  const auxParticiples = new Set<number>();
  tokens.forEach((t, i) => {
    if (isVerb(t.reading, 'essere') || isVerb(t.reading, 'avere')) {
      const j = participleAfter(tokens, i);
      if (j >= 0) auxParticiples.add(j);
    }
  });

  tokens.forEach((t, i) => {
    const r = t.reading;
    const prev = tokens[i - 1]?.reading ?? null;
    const next = tokens[i + 1]?.reading ?? null;
    const l = lemma(r);
    if (!r || !l) return;

    if (upos(r) === 'NOUN') add('noun-gender-number');
    if (isArticleHead(r) && hasUnit(r, 'il', 'DET')) add('definite-articles');
    if (hasUnit(r, 'un', 'DET')) add('indefinite-articles');
    if (upos(r) === 'PRON' && SUBJECT_PRONOUNS.has(l) && !(l === 'loro' && upos(next) === 'NOUN'))
      add('subject-pronouns');
    if (upos(r) === 'NOUN' && upos(next) === 'ADJ') add('adjective-agreement');
    if (l === 'non' && upos(r) === 'ADV') add('negation');
    if (upos(r) === 'ADP' && !isArtpre(r)) add('simple-prepositions');
    if (isArtpre(r)) add('articulated-prepositions');
    if (l === 'questo' || l === 'quello') add('demonstratives');
    if (POSSESSIVES.has(l) && r.heads.some((h) => h.includes('POSS'))) add('possessives');
    if (isVerb(r, 'piacere')) add('piacere');
    if (hasUnit(r, 'ne', 'PRON')) add('ne-partitive');
    if (isVerb(r) && hasInfl(r, 'cond')) add('conditional');
    if (isVerb(r) && hasInfl(r, 'ind+fut')) add('future');
    if (l === 'più' || l === 'meno') {
      const rest = tokens.slice(i + 1);
      if (rest.some((x) => x.lower === 'che' || hasUnit(x.reading, 'di', 'ADP')))
        add('comparatives');
    }
    if (['migliore', 'peggiore', 'meglio', 'peggio'].includes(l)) add('comparatives');

    if (isVerb(r)) {
      // Present tense families.
      if (finitePresent(r) && !auxParticiples.has(i)) {
        if (l === 'essere') add('essere-present');
        else if (l === 'avere') add('avere-present');
        else if (MODALS.has(l)) add('modal-verbs');
        else if (IRREGULAR_PRESENT.has(l)) add('irregular-present');
        else if (l.endsWith('are')) add('present-are');
        else if (l.endsWith('ere') || l.endsWith('ire')) add('present-ere-ire');
      }
      if (MODALS.has(l) && hasInfl(next, 'inf')) add('modal-verbs');
      if (hasInfl(r, 'ind+impf')) {
        seen.imperfetto = true;
        add(AUX.has(l) ? 'imperfetto-essere-avere' : 'imperfetto');
      }
      if (l === 'stare' && isVerb(next) && hasInfl(next, 'ger')) add('stare-gerund');
      // Enclitics on infinitives and imperatives.
      const enclitics = r.units.slice(1).map((u) => u.lemma);
      if (enclitics.some((c) => DIRECT_3RD.has(c))) add('direct-object-pronouns');
      if (
        hasInfl(r, 'inf') &&
        enclitics.some((c) => c === 'si' || (c in REFLEXIVE_CLITICS && personMatches(c, prev)))
      ) {
        add('reflexive-verbs');
      }
      if (hasInfl(r, 'impr') && enclitics.length > 0) add('imperative');

      // Passato prossimo: present of avere/essere + participle.
      if ((l === 'avere' || l === 'essere') && finitePresent(r)) {
        const j = participleAfter(tokens, i);
        const part = tokens[j]?.reading ?? null;
        const partLemma = lemma(part);
        if (j >= 0 && partLemma) {
          seen.passato = true;
          add(l === 'avere' ? 'passato-prossimo-avere' : 'passato-prossimo-essere');
          const stem = regularParticiple(partLemma);
          const form = tokens[j]?.lower ?? '';
          if (stem && !new RegExp(`^${stem}[oaie]$`).test(form)) add('irregular-participles');
          if (l === 'essere' && prev && isClitic(prev, REFLEXIVE_CLITICS)) {
            const c = lemma(prev) ?? '';
            if (personMatches(c, r) || (c === 'si' && persons(r).some((p) => p.startsWith('3')))) {
              add('reflexive-passato-prossimo');
            }
          }
          if (l === 'avere' && prev && isClitic(prev, DIRECT_3RD)) {
            add('object-pronouns-passato-prossimo');
          }
        }
      }
    }

    // Clitics before a finite verb.
    if (upos(r) === 'PRON' && isVerb(next)) {
      if (DIRECT_3RD.has(l) && l !== 'le') add('direct-object-pronouns');
      if (l === 'le' && !INDIRECT_VERBS.has(lemma(next) ?? '')) add('direct-object-pronouns');
      if (l === 'gli' || (l === 'le' && INDIRECT_VERBS.has(lemma(next) ?? ''))) {
        add(lemma(next) === 'piacere' ? 'piacere' : 'indirect-object-pronouns');
      }
      if (l in REFLEXIVE_CLITICS && personMatches(l, next) && !isVerb(next, 'essere')) {
        add('reflexive-verbs');
      }
      if (l === 'ci' && isVerb(next, 'essere')) add('ce-ci-sono');
      if (l === 'ci' && !isVerb(next, 'essere') && !personMatches('ci', next)) {
        add('ci-locative');
      }
    }
  });

  if (/\?\s*$/.test(sentence)) add('questions');
  if (
    /\b(chi|dove|quando|come|perché|quanto|quanta|quanti|quante|quale|quali)\b/i.test(sentence) &&
    sentence.includes('?')
  ) {
    add('questions');
  }
  // Imperative: sentence-initial verb form that can only be read as imperative here.
  const first = tokens[0]?.reading ?? null;
  if (/!\s*$/.test(sentence) && isVerb(first) && hasInfl(first, 'impr')) add('imperative');
  if (
    /!\s*$/.test(sentence) &&
    tokens[0]?.lower === 'non' &&
    hasInfl(tokens[1]?.reading ?? null, 'inf')
  ) {
    add('imperative');
  }
  // Predicative agreement: essere followed by an adjective.
  tokens.forEach((t, i) => {
    if (!isVerb(t.reading, 'essere')) return;
    for (let j = i + 1; j < tokens.length && j <= i + 2; j++) {
      const n = tokens[j]?.reading ?? null;
      if (upos(n) === 'ADJ') {
        add('predicative-agreement');
        return;
      }
      if (
        ![
          'molto',
          'più',
          'così',
          'troppo',
          'tanto',
          'proprio',
          'davvero',
          'sempre',
          'non',
          'già',
          'meno',
        ].includes(tokens[j]?.lower ?? '')
      )
        return;
    }
  });
  if (seen.passato && seen.imperfetto) add('passato-prossimo-vs-imperfetto');

  return [...found].map(grammarId).sort((a, b) => a - b);
}

/**
 * Verb forms beyond the A1-A2 graph (subjunctive, passato remoto). Sentences that
 * contain one are not used as anchors.
 */
export function usesOutOfScopeGrammar(tokens: readonly TaggedToken[]): boolean {
  return tokens.some((t) => {
    const r = t.reading;
    if (!isVerb(r) || !r || r.infl.length === 0) return false;
    return r.infl.every((i) => i.startsWith('sub+') || i.startsWith('ind+past'));
  });
}
