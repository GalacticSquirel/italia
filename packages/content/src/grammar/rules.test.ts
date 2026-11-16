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

describe('usesOutOfScopeGrammar', () => {
  it('flags unambiguous subjunctive and passato remoto forms', () => {
    const lex = testLexicon();
    lex.set('mangiasse', [
      { units: [{ lemma: 'mangiare', upos: 'VERB' }], heads: ['VER'], infl: ['sub+impf+3+s'] },
    ]);
    expect(usesOutOfScopeGrammar(tagSentence('Lui mangiasse.', lex, new Map()))).toBe(true);
    expect(usesOutOfScopeGrammar(tagSentence('Lui mangia.', lex, new Map()))).toBe(false);
  });
});
