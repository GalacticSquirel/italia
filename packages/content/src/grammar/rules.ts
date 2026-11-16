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
/**
 * Common verbs whose compound tenses take essere. Essere + participle of any
 * other verb is usually an adjective ("era chiusa"), so the compound-tense
 * rules beyond the passato prossimo only count these (or a reflexive).
 */
const ESSERE_VERBS = new Set([
  'andare',
  'venire',
  'arrivare',
  'partire',
  'uscire',
  'entrare',
  'tornare',
  'ritornare',
  'restare',
  'rimanere',
  'stare',
  'essere',
  'diventare',
  'nascere',
  'morire',
  'succedere',
  'cadere',
  'salire',
  'scendere',
  'riuscire',
  'piacere',
  'sembrare',
  'crescere',
  'cambiare',
  'finire',
  'cominciare',
  'passare',
  'scappare',
  'sparire',
]);

/** Weak pronouns that combine with a following clitic: me lo, te ne, se la. */
const COMBINING_CLITICS = new Set(['me', 'te', 'ce', 've', 'se']);
const SECOND_CLITICS = new Set(['lo', 'la', 'li', 'le', 'ne']);
const GLIE_FORMS = /^glie(lo|la|li|le|ne)$/;
/** Verbs and phrases before "che" that call for the subjunctive (opinion, wish, fear, doubt). */
const OPINION_CHE =
  /\b(penso|pensi|pensa|pensiamo|pensate|pensano|pensavo|pensava|credo|credi|crede|crediamo|credono|credevo|credeva|voglio|vuoi|vuole|vogliamo|volete|vogliono|volevo|voleva|vorrei|spero|speri|spera|speriamo|sperano|speravo|temo|teme|temevo|preferisco|preferisce|preferirei|dubito|immagino|sembra|sembrava|pare|mi auguro|ho paura)\s+che\b/i;
/** Impersonal expressions before "che" that call for the subjunctive. */
const IMPERSONAL_CHE =
  /\b((è|era|sarebbe|sarà)\s+(molto\s+|più\s+)?(importante|necessario|meglio|giusto|possibile|impossibile|probabile|improbabile|strano|normale|difficile|facile|bello|utile|inutile|ora|bene|naturale|incredibile)|bisogna|occorre|basta|conviene|serve|peccato)\s+che\b/i;
/** Conjunctions that always take the subjunctive. */
const SUBJUNCTIVE_CONJUNCTIONS =
  /\b(benché|sebbene|affinché|purché|nonostante|prima che|senza che|a meno che|a patto che|a condizione che|malgrado)\b/i;
/** Formal conditional and concessive conjunctions (C1). */
const FORMAL_CONJUNCTIONS = /\b(qualora|per quanto|ammesso che|nel caso in cui|casomai)\b/i;

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
/** Every reading of the form is in this mood/tense, e.g. `sub+impf` (so the form is unambiguous). */
const onlyInfl = (r: Reading | null, prefix: string) =>
  !!r && isVerb(r) && r.infl.length > 0 && r.infl.every((i) => i.startsWith(prefix));
/** Subjunctive or passato remoto forms, which only the B1+ rules cover. */
const isAdvancedForm = (r: Reading | null) => onlyInfl(r, 'sub+') || onlyInfl(r, 'ind+past');
/** A finite form (not infinitive, gerund or participle). */
const isFinite = (r: Reading | null) =>
  isVerb(r) &&
  !!r &&
  r.infl.some((i) => /^(ind|sub|cond|impr)\+/.test(i)) &&
  !hasInfl(r, 'part') &&
  !hasInfl(r, 'inf') &&
  !hasInfl(r, 'ger');
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

/** Index of a gerund following stare at position i (skipping a few adverbs), or -1. */
function gerundAfter(tokens: readonly TaggedToken[], i: number): number {
  for (let j = i + 1; j < tokens.length && j <= i + 3; j++) {
    const r = tokens[j]?.reading ?? null;
    if (isVerb(r) && hasInfl(r, 'ger')) return j;
    if (!BETWEEN_AUX_AND_PARTICIPLE.has(tokens[j]?.lower ?? '')) break;
  }
  return -1;
}

/** Whether the gerund at position i belongs to stare + gerund ("sta già mangiando"). */
function afterStare(tokens: readonly TaggedToken[], i: number): boolean {
  for (let j = i - 1; j >= 0 && j >= i - 3; j--) {
    const t = tokens[j];
    if (isVerb(t?.reading ?? null, 'stare')) return gerundAfter(tokens, j) === i;
    if (!BETWEEN_AUX_AND_PARTICIPLE.has(t?.lower ?? '')) return false;
  }
  return false;
}

/** Detect grammar points used by a tagged sentence. Returns sorted ids. */
export function detectGrammar(sentence: string, tokens: readonly TaggedToken[]): number[] {
  return [...analyse(sentence, tokens).found].map(grammarId).sort((a, b) => a - b);
}

/**
 * The grammar slugs a sentence uses, and the indexes of subjunctive or
 * passato remoto forms that a rule accounted for.
 */
function analyse(
  sentence: string,
  tokens: readonly TaggedToken[],
): { found: Set<string>; covered: Set<number> } {
  const found = new Set<string>();
  const covered = new Set<number>();
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
      if (l === 'stare' && gerundAfter(tokens, i) >= 0) add('stare-gerund');
      if (
        l === 'stare' &&
        tokens[i + 1]?.lower === 'per' &&
        hasInfl(tokens[i + 2]?.reading ?? null, 'inf')
      ) {
        add('stare-per');
      }
      // Simple tenses beyond the A2 core (compound tenses are handled below).
      if (!AUX.has(l) || participleAfter(tokens, i) < 0) {
        if (onlyInfl(r, 'sub+pres')) {
          add('subjunctive-present');
          covered.add(i);
        }
        if (onlyInfl(r, 'sub+impf')) {
          add('subjunctive-imperfect');
          covered.add(i);
        }
        if (onlyInfl(r, 'ind+past')) {
          add('passato-remoto');
          covered.add(i);
        }
      }
      if (
        onlyInfl(r, 'ger') &&
        !afterStare(tokens, i) &&
        !(AUX.has(l) && participleAfter(tokens, i) >= 0)
      ) {
        add('gerund-clauses');
      }
      // Passive with venire / andare: "viene servito", "va fatto".
      if ((l === 'venire' || l === 'andare') && isFinite(r) && isParticiple(next)) {
        add('passive-venire-andare');
      }
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

      // Compound tenses of avere/essere + participle beyond the passato prossimo.
      if (AUX.has(l)) {
        const j = participleAfter(tokens, i);
        const partLemma = lemma(tokens[j]?.reading ?? null) ?? '';
        const compound =
          j >= 0 &&
          (l === 'avere' || ESSERE_VERBS.has(partLemma) || isClitic(prev, REFLEXIVE_CLITICS));
        if (compound) {
          const tense = (prefix: string) => hasInfl(r, prefix);
          if (onlyInfl(r, 'sub+pres')) {
            add('subjunctive-past');
            covered.add(i);
          } else if (onlyInfl(r, 'sub+impf')) {
            add('subjunctive-pluperfect');
            covered.add(i);
          } else if (onlyInfl(r, 'ind+past')) {
            add('trapassato-remoto');
            covered.add(i);
          } else if (tense('ind+impf')) add('trapassato-prossimo');
          else if (tense('ind+fut')) add('future-perfect-probability');
          else if (tense('cond')) add('conditional-past');
          else if (tense('inf')) add('infinitive-past');
          else if (tense('ger')) add('past-gerund');
          // "è stato costruito": essere + stato + participle.
          if (l === 'essere' && isVerb(tokens[j]?.reading ?? null, 'essere')) {
            if (participleAfter(tokens, j) >= 0) add('passive-essere');
          }
        }
      }

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

    // Combined pronouns: glielo, me lo, te ne (before a verb), or two enclitics (dammelo).
    if (GLIE_FORMS.test(t.lower)) add('combined-pronouns');
    if (
      COMBINING_CLITICS.has(t.lower) &&
      upos(r) === 'PRON' &&
      SECOND_CLITICS.has(tokens[i + 1]?.lower.replace("'", '') ?? '') &&
      isVerb(tokens[i + 2]?.reading ?? null)
    ) {
      add('combined-pronouns');
    }
    if (isVerb(r) && r.units.length >= 3) add('combined-pronouns');
    // Relatives: cui, il cui (whose), il quale, ciò che.
    if (l === 'cui') {
      const before = tokens[i - 1]?.reading ?? null;
      add(isArticleHead(before) && !isArtpre(before) ? 'cui-possessive' : 'relative-che-cui');
    }
    if (l === 'quale' && isArticleHead(prev) && !/\?\s*$/.test(sentence)) add('relatives-advanced');
    if (t.lower === 'ciò' && tokens[i + 1]?.lower === 'che') add('relatives-advanced');

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

  // Subjunctive in context: after opinion and impersonal expressions,
  // conjunctions, "se" and "come se".
  const presentSub = found.has('subjunctive-present') || found.has('subjunctive-past');
  const pastSub = found.has('subjunctive-imperfect') || found.has('subjunctive-pluperfect');
  if (presentSub || pastSub) {
    if (OPINION_CHE.test(sentence))
      add(presentSub ? 'subjunctive-opinion-wish' : 'sequence-of-tenses');
    if (IMPERSONAL_CHE.test(sentence)) {
      add(presentSub ? 'subjunctive-impersonal' : 'sequence-of-tenses');
    }
    if (SUBJUNCTIVE_CONJUNCTIONS.test(sentence)) add('subjunctive-conjunctions');
    if (FORMAL_CONJUNCTIONS.test(sentence)) add('advanced-conjunctions');
  }
  if (pastSub && /\bcome se\b/i.test(sentence)) add('come-se');
  else if (pastSub && /\bse\b/i.test(sentence)) {
    const result = found.has('conditional') || found.has('conditional-past');
    if (result) add(found.has('subjunctive-pluperfect') ? 'if-past-unreal' : 'if-hypothetical');
  }

  return { found, covered };
}

/**
 * Whether a sentence has a subjunctive or passato remoto form that no grammar
 * rule accounts for (so its grammar tags would be incomplete). Such sentences
 * are not used. Forms the rules cover are tagged with their grammar point
 * instead, and a story band's grammar ceiling decides whether they may appear.
 */
export function usesOutOfScopeGrammar(tokens: readonly TaggedToken[]): boolean {
  const { covered } = analyse('', tokens);
  return tokens.some((t, i) => isAdvancedForm(t.reading) && !covered.has(i));
}
