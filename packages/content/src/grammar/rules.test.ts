import { describe, expect, it } from 'vitest';

import { GRAMMAR_POINTS } from './points';
import { detectGrammar, grammarId, usesOutOfScopeGrammar } from './rules';
import { tagSentence } from '../pipeline/tagger';
import { testLexicon } from '../pipeline/test-lexicon';

const lexicon = testLexicon();
const slugs = (sentence: string) => {
  const ids = detectGrammar(sentence, tagSentence(sentence, lexicon, new Map()));
  return ids.map((id) => GRAMMAR_POINTS.find((p) => p.id === id)?.slug);
};

describe('tagSentence', () => {
  it('uses context to choose between readings', () => {
    const tagged = tagSentence('Lui porta la mela.', lexicon, new Map());
    expect(tagged.map((t) => t.reading?.units[0]?.lemma)).toEqual(['lui', 'portare', 'il', 'mela']);
    const pronoun = tagSentence('Io la mangio.', lexicon, new Map());
    expect(pronoun[1]?.reading?.units[0]).toEqual({ lemma: 'la', upos: 'PRON' });
  });

  it('marks unknown capitalised words as proper nouns', () => {
    const tagged = tagSentence('Io vado a Milano.', lexicon, new Map());
    expect(tagged.map((t) => t.properNoun)).toEqual([false, false, false, true]);
  });
});

describe('detectGrammar', () => {
  it('detects noun-phrase grammar', () => {
    expect(slugs('La mela rossa è nel libro.')).toEqual(
      expect.arrayContaining([
        'definite-articles',
        'adjective-agreement',
        'essere-present',
        'articulated-prepositions',
      ]),
    );
    expect(slugs('Una mela.')).toContain('indefinite-articles');
    expect(slugs('Questa è la mia casa.')).toEqual(
      expect.arrayContaining(['demonstratives', 'possessives']),
    );
  });

  it('detects verb tenses', () => {
    expect(slugs('Io ho mangiato.')).toContain('passato-prossimo-avere');
    expect(slugs('Io ho già mangiato.')).toContain('passato-prossimo-avere');
    expect(slugs('Lui ha fatto.')).toContain('irregular-participles');
    expect(slugs('Io sono andata.')).toContain('passato-prossimo-essere');
    expect(slugs('Io sono andata.')).not.toContain('present-are');
    expect(slugs('Mi sono alzata.')).toContain('reflexive-passato-prossimo');
    expect(slugs('Mi alzo.')).toContain('reflexive-verbs');
    expect(slugs('Era bella.')).toContain('imperfetto-essere-avere');
    expect(slugs('Mangerò.')).toContain('future');
    expect(slugs('Lui sta dormendo.')).toContain('stare-gerund');
    expect(slugs('Mangio.')).toContain('present-are');
    expect(slugs('Vado.')).toContain('irregular-present');
    expect(slugs('Lui vuole studiare.')).toContain('modal-verbs');
  });

  it('detects clitics, negation, questions and more', () => {
    expect(slugs("L'ho mangiata.")).toContain('object-pronouns-passato-prossimo');
    expect(slugs('Io lo mangio.')).toContain('direct-object-pronouns');
    expect(slugs('Non mangio.')).toContain('negation');
    expect(slugs('Mangio?')).toContain('questions');
    expect(slugs("C'è una casa.")).toContain('ce-ci-sono');
    expect(slugs('Mi piace.')).toContain('piacere');
    expect(slugs('Ne mangio.')).toContain('ne-partitive');
    expect(slugs('Dimmi!')).toContain('imperative');
  });

  it('returns sorted, valid ids', () => {
    const ids = detectGrammar('La mela.', tagSentence('La mela.', lexicon, new Map()));
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    expect(() => grammarId('nope')).toThrow();
  });
});

describe('advanced grammar (B1 to C1)', () => {
  type Row = [form: string, lemma: string, upos: 'VERB' | 'PRON', infl: string[]];
  const rows: Row[] = [
    ['mangiasse', 'mangiare', 'VERB', ['sub+impf+3+s']],
    ['venga', 'venire', 'VERB', ['sub+pres+1+s', 'sub+pres+2+s', 'sub+pres+3+s']],
    ['sia', 'essere', 'VERB', ['sub+pres+1+s', 'sub+pres+2+s', 'sub+pres+3+s']],
    ['fosse', 'essere', 'VERB', ['sub+impf+3+s']],
    ['avessi', 'avere', 'VERB', ['sub+impf+1+s', 'sub+impf+2+s']],
    ['andò', 'andare', 'VERB', ['ind+past+3+s']],
    ['ebbe', 'avere', 'VERB', ['ind+past+3+s']],
    ['avevo', 'avere', 'VERB', ['ind+impf+1+s']],
    ['avrà', 'avere', 'VERB', ['ind+fut+3+s']],
    ['avrei', 'avere', 'VERB', ['cond+pres+1+s']],
    ['comprerei', 'comprare', 'VERB', ['cond+pres+1+s']],
    ['avendo', 'avere', 'VERB', ['ger+pres']],
    ['aver', 'avere', 'VERB', ['inf+pres']],
    ['mangiando', 'mangiare', 'VERB', ['ger+pres']],
    ['viene', 'venire', 'VERB', ['ind+pres+3+s']],
    ['stato', 'essere', 'VERB', ['part+past+s+m']],
    ['costruito', 'costruire', 'VERB', ['part+past+s+m']],
    ['finito', 'finire', 'VERB', ['part+past+s+m']],
    ['partito', 'partire', 'VERB', ['part+past+s+m']],
    ['saputo', 'sapere', 'VERB', ['part+past+s+m']],
    ['sto', 'stare', 'VERB', ['ind+pres+1+s']],
    ['uscire', 'uscire', 'VERB', ['inf+pres']],
    ['penso', 'pensare', 'VERB', ['ind+pres+1+s']],
    ['glielo', 'glielo', 'PRON', []],
    ['cui', 'cui', 'PRON', []],
  ];
  const lex = testLexicon();
  for (const [form, lemma, upos, infl] of rows) {
    lex.set(form, [{ units: [{ lemma, upos }], heads: [upos === 'VERB' ? 'VER' : 'PRO'], infl }]);
  }
  const tags = (sentence: string) =>
    detectGrammar(sentence, tagSentence(sentence, lex, new Map())).map(
      (id) => GRAMMAR_POINTS.find((p) => p.id === id)?.slug,
    );

  it('tags subjunctive tenses and the clauses that need them', () => {
    expect(tags('Penso che venga.')).toEqual(
      expect.arrayContaining(['subjunctive-present', 'subjunctive-opinion-wish']),
    );
    expect(tags('Penso che sia partito.')).toContain('subjunctive-past');
    expect(tags('Lui mangiasse.')).toContain('subjunctive-imperfect');
    expect(tags('Se avessi saputo, avrei mangiato.')).toEqual(
      expect.arrayContaining(['subjunctive-pluperfect', 'conditional-past', 'if-past-unreal']),
    );
    expect(tags('Se fosse bella, comprerei la casa.')).toContain('if-hypothetical');
    expect(tags('Mangio come se fosse la casa.')).toContain('come-se');
  });

  it('tags compound and narrative tenses', () => {
    expect(tags('Andò a casa.')).toContain('passato-remoto');
    expect(tags('Ebbe finito.')).toContain('trapassato-remoto');
    expect(tags('Avevo già mangiato.')).toContain('trapassato-prossimo');
    expect(tags('Avrà finito.')).toContain('future-perfect-probability');
    expect(tags('Avrei mangiato.')).toContain('conditional-past');
    expect(tags('Avendo finito, vado.')).toContain('past-gerund');
    expect(tags('Dopo aver mangiato, vado.')).toContain('infinitive-past');
    expect(tags('Mangiando, leggo.')).toContain('gerund-clauses');
    expect(tags('Lui sta dormendo.')).not.toContain('gerund-clauses');
    expect(tags('Sto per uscire.')).toContain('stare-per');
  });

  it('tags the passive, combined pronouns and relatives', () => {
    expect(tags('Il libro è stato costruito.')).toContain('passive-essere');
    expect(tags('Il libro viene costruito.')).toContain('passive-venire-andare');
    expect(tags('Glielo porto.')).toContain('combined-pronouns');
    expect(tags('La casa in cui vivo.')).toContain('relative-che-cui');
  });

  it('treats subjunctive and passato remoto forms the rules cover as in scope', () => {
    expect(usesOutOfScopeGrammar(tagSentence('Lui mangiasse.', lex, new Map()))).toBe(false);
    expect(usesOutOfScopeGrammar(tagSentence('Andò a casa.', lex, new Map()))).toBe(false);
    expect(usesOutOfScopeGrammar(tagSentence('Lui mangia.', lex, new Map()))).toBe(false);
  });
});
