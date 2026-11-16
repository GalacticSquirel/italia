import { describe, expect, it } from 'vitest';

import { parseStorySource } from './source';
import {
  createLemmaResolver,
  createStoryTagger,
  parseVariantSpellings,
  type StoryLemma,
  tokenLemmaIds,
} from './tagger';
import { grammarId } from '../grammar/rules';
import { lemmaId } from '../pipeline/ids';
import { parseMorphIt, type Upos } from '../pipeline/lexicon';

const lexicon = parseMorphIt(`
il	il	ART-M:s
la	la	ART-F:s
la	la	PRO-PERS-CLI-3-F-S
l'	l'	ART-F:s
l'	l'	ART-M:s
nel	nel	ARTPRE-M:s
dell'	dell'	ARTPRE-F:s
una	una	ART-F:s
di	di	PRE
e	e	CON
non	non	ADV
c'	c'	ADV
mi	mi	PRO-PERS-CLI-1-M-S
si	si	PRO-PERS-CLI-3-M-S
io	io	PRO-PERS-1-M-S
è	essere	VER:ind+pres+3+s
sia	essere	VER:sub+pres+3+s
mangia	mangiare	VER:ind+pres+3+s
mangio	mangiare	VER:ind+pres+1+s
dimmi	dimmi	VER:impr+pres+2+s+mi
alzarsi	alzare	VER:inf+pres+si
vuole	volere	MOD:ind+pres+3+s
casa	casa	NOUN-F:s
mela	mela	NOUN-F:s
mele	mela	NOUN-F:p
acqua	acqua	NOUN-F:s
amica	amica	NOUN-F:s
pizza	pizza	NOUN-F:s
bella	bello	ADJ:pos+f+s
bella	bella	NOUN-F:s
rossa	rosso	ADJ:pos+f+s
`);

const seedRows: [string, Upos][] = [
  ['il', 'DET'],
  ['essere', 'VERB'],
  ['di', 'ADP'],
  ['e', 'CCONJ'],
  ['un', 'DET'],
  ['non', 'ADV'],
  ['in', 'ADP'],
  ['mi', 'PRON'],
  ['ci', 'PRON'],
  ['si', 'PRON'],
  ['io', 'PRON'],
  ['la', 'PRON'],
  ['dire', 'VERB'],
  ['volere', 'VERB'],
  ['mangiare', 'VERB'],
  ['alzare', 'VERB'],
  ['casa', 'NOUN'],
  ['mela', 'NOUN'],
  ['acqua', 'NOUN'],
  ['bello', 'ADJ'],
  ['rosso', 'ADJ'],
  ['amica', 'NOUN'],
];
// Ranks: content words start above the target floor (rank 20).
const lemmas: StoryLemma[] = seedRows.map(([lemma, pos], i) => ({
  id: lemmaId(lemma, pos),
  lemma,
  pos,
  freqRank: i < 15 ? i + 1 : (i + 1) * 10,
}));
const id = (lemma: string, pos: Upos) => lemmaId(lemma, pos);
const tagger = createStoryTagger({ lexicon, subtlex: new Map(), lemmas });
const tag = (it: string, names: string[] = []) => tagger.tagStorySentence(it, new Set(names));

describe('createLemmaResolver', () => {
  it('matches lemma and POS, then falls back to the same lemma under another POS', () => {
    const resolve = createLemmaResolver(lemmas);
    expect(resolve({ lemma: 'casa', upos: 'NOUN' })).toBe(id('casa', 'NOUN'));
    expect(resolve({ lemma: 'casa', upos: 'ADJ' })).toBe(id('casa', 'NOUN'));
    expect(resolve({ lemma: 'pizza', upos: 'NOUN' })).toBeNull();
  });
});

describe('tagStorySentence', () => {
  it('splits elision and maps contractions and enclitics to several lemmas', () => {
    const { sentence, issues } = tag("Dimmi, Luca: c'è l'acqua nel bicchiere dell'amica?", [
      'Luca',
    ]);
    const byText = new Map(sentence.tokens.map((t) => [t.text, t]));
    expect(byText.get('Dimmi')).toMatchObject({
      lemmaId: id('dire', 'VERB'),
      partIds: [id('mi', 'PRON')],
    });
    expect(byText.get('Luca')).toEqual({
      text: 'Luca',
      start: 7,
      end: 11,
      lemmaId: null,
      isName: true,
    });
    expect(byText.get("c'")?.lemmaId).toBe(id('ci', 'PRON'));
    expect(byText.get('è')?.lemmaId).toBe(id('essere', 'VERB'));
    expect(byText.get("l'")?.lemmaId).toBe(id('il', 'DET'));
    expect(byText.get('nel')).toMatchObject({
      lemmaId: id('in', 'ADP'),
      partIds: [id('il', 'DET')],
    });
    expect(
      tokenLemmaIds(byText.get("dell'") ?? { text: '', start: 0, end: 1, lemmaId: null }),
    ).toEqual([id('di', 'ADP'), id('il', 'DET')]);
    // "bicchiere" is not in the lexicon.
    expect(issues).toEqual(['"bicchiere" is not a seed lemma']);
    expect(sentence.grammarIds).toContain(grammarId('ce-ci-sono'));
    for (const t of sentence.tokens) expect(sentence.it.slice(t.start, t.end)).toBe(t.text);
  });

  it('tags infinitives with an enclitic and keeps names that are also words', () => {
    const { sentence, issues } = tag('Bella vuole alzarsi.', ['Bella']);
    expect(issues).toEqual([]);
    expect(sentence.tokens.map((t) => t.lemmaId)).toEqual([
      null,
      id('volere', 'VERB'),
      id('alzare', 'VERB'),
    ]);
    expect(sentence.tokens[0]?.isName).toBe(true);
    expect(sentence.tokens[2]?.partIds).toEqual([id('si', 'PRON')]);
  });

  it('reports words outside the seed, undeclared names and out-of-scope verb forms', () => {
    expect(tag('Io mangio la pizza.').issues).toEqual(['"pizza" is not a seed lemma']);
    expect(tag('Io mangio a Milano.').issues).toEqual([
      '"a" is not a seed lemma',
      '"Milano" looks like a name: add it to "names:" or use another word',
    ]);
    expect(tag('È possibile che sia bella.').issues).toContain(
      'subjunctive or passato remoto form in "È possibile che sia bella."',
    );
  });
});

describe('tagStory', () => {
  const source = parseStorySource(
    [
      'title: La mela | The apple',
      'names: Sara',
      '',
      'Sara mangia una mela. | Sara is eating an apple.',
      'La mela è rossa. | The apple is red.',
      '',
      'Non mangio la mela rossa. | I am not eating the red apple.',
      'Sara mangia la mela e mangia la mela. | Sara eats the apple and eats the apple.',
    ].join('\n'),
  );

  it('builds a story with ids, counts and repeated new words as targets', () => {
    const { story, issues } = tagger.tagStory(source, {
      seriesId: 'la-mela',
      seriesIndex: 3,
      band: 150,
    });
    expect(issues).toEqual([]);
    expect(story.id).toBe('la-mela-03');
    expect(story.level).toBe('A1');
    expect(story.paragraphs.map((p) => p.sentences.length)).toEqual([2, 2]);
    expect(story.wordCount).toBe(4 + 4 + 5 + 8);
    // mela (x6) and rosso (x2) are repeated content words above rank 20;
    // mangiare (rank 15) is too frequent to be a target.
    expect(story.targetLemmaIds).toEqual([id('mela', 'NOUN'), id('rosso', 'ADJ')]);
    expect(story.grammarIds).toEqual(
      [...new Set(story.paragraphs.flatMap((p) => p.sentences.flatMap((s) => s.grammarIds)))].sort(
        (a, b) => a - b,
      ),
    );
  });

  it('prefers words that earlier episodes have not taught yet', () => {
    const { story } = tagger.tagStory(
      source,
      { seriesId: 'la-mela', seriesIndex: 4, band: 150 },
      { taught: new Set([id('mela', 'NOUN')]) },
    );
    expect(story.targetLemmaIds).toEqual([id('rosso', 'ADJ'), id('mela', 'NOUN')]);
  });

  it('tags comprehension questions without counting them in the story', () => {
    const withQuestions = parseStorySource(
      [
        'title: La mela | The apple',
        'names: Sara',
        '',
        'Sara mangia una mela. | Sara is eating an apple.',
        '',
        'questions:',
        '? Sara mangia una casa? | Is Sara eating a house?',
        '- Mangia una casa rossa. | She is eating a red house.',
        "* Non mangia una casa: mangia una mela. | She isn't eating a house: she's eating an apple.",
      ].join('\n'),
    );
    const { story, issues } = tagger.tagStory(withQuestions, {
      seriesId: 'la-mela',
      seriesIndex: 1,
      band: 150,
    });
    expect(issues).toEqual([]);
    expect(story.wordCount).toBe(4);
    expect(story.questions).toHaveLength(1);
    const [q] = story.questions;
    expect(q?.answer).toBe(1);
    expect(q?.prompt.en).toBe('Is Sara eating a house?');
    expect(q?.prompt.tokens.map((t) => t.text)).toEqual(['Sara', 'mangia', 'una', 'casa']);
    expect(q?.prompt.tokens[0]?.isName).toBe(true);
    expect(q?.options[1]?.tokens.at(-1)?.lemmaId).toBe(id('mela', 'NOUN'));
  });
});

describe('createLemmaResolver', () => {
  it('maps variant spellings the seed merged to their base word', () => {
    const resolve = createLemmaResolver(
      [{ id: 7, lemma: 'e', pos: 'CCONJ', freqRank: 4 }],
      parseVariantSpellings(['ed|CCONJ -> e|CCONJ', 'alcun|PRON -> e (shown as)', 'junk']),
    );
    expect(resolve({ lemma: 'ed', upos: 'CCONJ' })).toBe(7);
    expect(resolve({ lemma: 'alcun', upos: 'PRON' })).toBe(7);
    expect(resolve({ lemma: 'ad', upos: 'ADP' })).toBeNull();
  });
});
