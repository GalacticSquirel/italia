/**
 * DEVELOPMENT AND TEST FIXTURE ONLY. Never shipped as content.
 *
 * A tiny hand-written seed (33 lemmas, 30 sentences, 3 grammar points) so the
 * screens can be exercised before `packages/content` delivers the real seed.
 * Development builds load it only while the bundled seed is empty (see
 * `devSeedLoader`), and production bundles drop it entirely.
 *
 * The sentences were written for this fixture (CC0); they are not taken from
 * any corpus.
 */
import type { SentenceToken } from '@/db/schema';

import type { Seed } from '../data/seed/seedSchema';

/** Version of the fixture seed: below any real seed version (1 and up). */
export const DEV_FIXTURE_SEED_VERSION = '0.1';

type LemmaSpec = [id: number, lemma: string, pos: string, gloss: string];

const LEMMAS: LemmaSpec[] = [
  [1, 'essere', 'VERB', 'to be'],
  [2, 'il', 'DET', 'the'],
  [3, 'io', 'PRON', 'I'],
  [4, 'tu', 'PRON', 'you (informal)'],
  [5, 'non', 'ADV', 'not'],
  [6, 'a', 'ADP', 'to, at'],
  [7, 'e', 'CCONJ', 'and'],
  [8, 'in', 'ADP', 'in'],
  [9, 'lui', 'PRON', 'he'],
  [10, 'lei', 'PRON', 'she'],
  [11, 'casa', 'NOUN', 'house, home'],
  [12, 'molto', 'ADV', 'very, a lot'],
  [13, 'oggi', 'ADV', 'today'],
  [14, 'sempre', 'ADV', 'always'],
  [15, 'parlare', 'VERB', 'to speak, to talk'],
  [16, 'bello', 'ADJ', 'beautiful, handsome'],
  [17, 'buono', 'ADJ', 'good'],
  [18, 'grande', 'ADJ', 'big'],
  [19, 'piccolo', 'ADJ', 'small'],
  [20, 'libro', 'NOUN', 'book'],
  [21, 'amico', 'NOUN', 'friend'],
  [22, 'città', 'NOUN', 'city'],
  [23, 'mangiare', 'VERB', 'to eat'],
  [24, 'lavorare', 'VERB', 'to work'],
  [25, 'cercare', 'VERB', 'to look for'],
  [26, 'italiano', 'NOUN', 'Italian (language)'],
  [27, 'abitare', 'VERB', 'to live (somewhere)'],
  [28, 'studiare', 'VERB', 'to study'],
  [29, 'stanco', 'ADJ', 'tired'],
  [30, 'gatto', 'NOUN', 'cat'],
  [31, 'pane', 'NOUN', 'bread'],
  [32, 'acqua', 'NOUN', 'water'],
  [33, 'caffè', 'NOUN', 'coffee'],
];

type SentenceSpec = [
  it: string,
  en: string,
  words: [surface: string, lemmaId: number][],
  grammar: number[],
];

const SENTENCES: SentenceSpec[] = [
  [
    'Io sono stanco.',
    'I am tired.',
    [
      ['Io', 3],
      ['sono', 1],
      ['stanco', 29],
    ],
    [1],
  ],
  [
    'La casa è grande.',
    'The house is big.',
    [
      ['La', 2],
      ['casa', 11],
      ['è', 1],
      ['grande', 18],
    ],
    [1, 2],
  ],
  [
    'Il gatto è piccolo.',
    'The cat is small.',
    [
      ['Il', 2],
      ['gatto', 30],
      ['è', 1],
      ['piccolo', 19],
    ],
    [1, 2],
  ],
  [
    'Tu sei molto bello.',
    'You are very handsome.',
    [
      ['Tu', 4],
      ['sei', 1],
      ['molto', 12],
      ['bello', 16],
    ],
    [1],
  ],
  [
    'Il libro è bello.',
    'The book is beautiful.',
    [
      ['Il', 2],
      ['libro', 20],
      ['è', 1],
      ['bello', 16],
    ],
    [1, 2],
  ],
  [
    'Io parlo italiano.',
    'I speak Italian.',
    [
      ['Io', 3],
      ['parlo', 15],
      ['italiano', 26],
    ],
    [3],
  ],
  [
    'Tu mangi il pane.',
    'You are eating the bread.',
    [
      ['Tu', 4],
      ['mangi', 23],
      ['il', 2],
      ['pane', 31],
    ],
    [2, 3],
  ],
  [
    'Lei lavora oggi.',
    'She is working today.',
    [
      ['Lei', 10],
      ['lavora', 24],
      ['oggi', 13],
    ],
    [3],
  ],
  [
    'Il caffè è buono.',
    'The coffee is good.',
    [
      ['Il', 2],
      ['caffè', 33],
      ['è', 1],
      ['buono', 17],
    ],
    [1, 2],
  ],
  [
    'Io abito in città.',
    'I live in the city.',
    [
      ['Io', 3],
      ['abito', 27],
      ['in', 8],
      ['città', 22],
    ],
    [3],
  ],
  [
    'Lui non è stanco.',
    'He is not tired.',
    [
      ['Lui', 9],
      ['non', 5],
      ['è', 1],
      ['stanco', 29],
    ],
    [1],
  ],
  [
    "L'acqua è buona.",
    'The water is good.',
    [
      ["L'", 2],
      ['acqua', 32],
      ['è', 1],
      ['buona', 17],
    ],
    [1, 2],
  ],
  [
    "L'amico studia molto.",
    'The friend studies a lot.',
    [
      ["L'", 2],
      ['amico', 21],
      ['studia', 28],
      ['molto', 12],
    ],
    [2, 3],
  ],
  [
    'Cerco il libro.',
    'I am looking for the book.',
    [
      ['Cerco', 25],
      ['il', 2],
      ['libro', 20],
    ],
    [2, 3],
  ],
  [
    'Lei è sempre stanca.',
    'She is always tired.',
    [
      ['Lei', 10],
      ['è', 1],
      ['sempre', 14],
      ['stanca', 29],
    ],
    [1],
  ],
  [
    'Tu parli molto.',
    'You talk a lot.',
    [
      ['Tu', 4],
      ['parli', 15],
      ['molto', 12],
    ],
    [3],
  ],
  [
    'Io mangio sempre il pane.',
    'I always eat the bread.',
    [
      ['Io', 3],
      ['mangio', 23],
      ['sempre', 14],
      ['il', 2],
      ['pane', 31],
    ],
    [2, 3],
  ],
  [
    'La città è molto bella.',
    'The city is very beautiful.',
    [
      ['La', 2],
      ['città', 22],
      ['è', 1],
      ['molto', 12],
      ['bella', 16],
    ],
    [1, 2],
  ],
  [
    'Lui lavora a casa.',
    'He works at home.',
    [
      ['Lui', 9],
      ['lavora', 24],
      ['a', 6],
      ['casa', 11],
    ],
    [3],
  ],
  [
    'Io studio italiano oggi.',
    'I am studying Italian today.',
    [
      ['Io', 3],
      ['studio', 28],
      ['italiano', 26],
      ['oggi', 13],
    ],
    [3],
  ],
  [
    'Il caffè e il pane.',
    'Coffee and bread.',
    [
      ['Il', 2],
      ['caffè', 33],
      ['e', 7],
      ['il', 2],
      ['pane', 31],
    ],
    [2],
  ],
  [
    'Sei a casa?',
    'Are you at home?',
    [
      ['Sei', 1],
      ['a', 6],
      ['casa', 11],
    ],
    [1],
  ],
  [
    'Il gatto mangia.',
    'The cat is eating.',
    [
      ['Il', 2],
      ['gatto', 30],
      ['mangia', 23],
    ],
    [2, 3],
  ],
  [
    'Il gatto non è grande.',
    'The cat is not big.',
    [
      ['Il', 2],
      ['gatto', 30],
      ['non', 5],
      ['è', 1],
      ['grande', 18],
    ],
    [1, 2],
  ],
  [
    'Lei abita in città.',
    'She lives in the city.',
    [
      ['Lei', 10],
      ['abita', 27],
      ['in', 8],
      ['città', 22],
    ],
    [3],
  ],
  [
    'Io sono a casa oggi.',
    'I am at home today.',
    [
      ['Io', 3],
      ['sono', 1],
      ['a', 6],
      ['casa', 11],
      ['oggi', 13],
    ],
    [1],
  ],
  [
    'Lui cerca il gatto.',
    'He is looking for the cat.',
    [
      ['Lui', 9],
      ['cerca', 25],
      ['il', 2],
      ['gatto', 30],
    ],
    [2, 3],
  ],
  [
    "L'italiano è bello.",
    'Italian is beautiful.',
    [
      ["L'", 2],
      ['italiano', 26],
      ['è', 1],
      ['bello', 16],
    ],
    [1, 2],
  ],
  [
    'Tu studi sempre.',
    'You always study.',
    [
      ['Tu', 4],
      ['studi', 28],
      ['sempre', 14],
    ],
    [3],
  ],
  [
    'Il pane è buono.',
    'The bread is good.',
    [
      ['Il', 2],
      ['pane', 31],
      ['è', 1],
      ['buono', 17],
    ],
    [1, 2],
  ],
];

const GRAMMAR: Seed['grammarPoints'] = [
  {
    id: 1,
    title: 'Essere (to be) in the present',
    order: 1,
    prerequisiteIds: [],
    noteMd: [
      '**Essere** means *to be*. Its present tense is irregular, so learn it by heart:',
      '',
      '- io **sono** (I am)',
      '- tu **sei** (you are)',
      '- lui, lei **è** (he, she is)',
      '',
      'Italian usually drops the subject pronoun: *Sono stanco* means *I am tired*.',
    ].join('\n'),
  },
  {
    id: 2,
    title: 'Definite articles: il, la, l’',
    order: 2,
    prerequisiteIds: [1],
    noteMd: [
      'The word for *the* agrees with the noun:',
      '',
      '- **il** before most masculine nouns: *il gatto*',
      '- **la** before feminine nouns: *la casa*',
      "- **l'** before a vowel: *l'acqua*, *l'amico*",
      '',
      'Italian uses the article more than English: *Il caffè è buono* (Coffee is good).',
    ].join('\n'),
  },
  {
    id: 3,
    title: 'Present tense: regular -are verbs',
    order: 3,
    prerequisiteIds: [1],
    noteMd: [
      'Most verbs end in **-are**. Drop **-are** and add the ending:',
      '',
      '- io parl**o** (I speak)',
      '- tu parl**i** (you speak)',
      '- lui, lei parl**a** (he, she speaks)',
      '',
      'Verbs in **-care** keep the hard sound: *tu cerchi*.',
    ].join('\n'),
  },
];

/**
 * Tokens in the `@italia/content` format: `[start, end, ...lemmaIndexes]`,
 * each index pointing into `lemmaIds`.
 */
function tokensFor(
  it: string,
  words: SentenceSpec[2],
  lemmaIds: readonly number[],
): SentenceToken[] {
  let cursor = 0;
  return words.map(([surface, lemmaId]) => {
    const start = it.indexOf(surface, cursor);
    if (start < 0) throw new Error(`fixture word "${surface}" not found in "${it}"`);
    cursor = start + surface.length;
    return [start, cursor, lemmaIds.indexOf(lemmaId)];
  });
}

/** The development fixture seed. */
export const DEV_FIXTURE_SEED: Seed = {
  version: DEV_FIXTURE_SEED_VERSION,
  generatedAt: '2026-11-15T00:00:00.000Z',
  sources: [{ id: 'dev-fixture', licence: 'CC0-1.0', note: 'Development fixture only' }],
  lemmas: LEMMAS.map(([id, lemma, pos, glossEn]) => ({
    id,
    lemma,
    pos,
    freqRank: id,
    glossEn,
    audioRef: null,
  })),
  sentences: SENTENCES.map(([it, en, words, grammarIds], i) => {
    const lemmaIds = [...new Set(words.map(([, lemmaId]) => lemmaId))];
    return {
      id: i + 1,
      it,
      en,
      lemmaIds,
      grammarIds,
      source: `dev-fixture:${String(i + 1)}`,
      licence: 'CC0-1.0',
      // Same place and shape as the real seed: `extra.tokens` with lemma indexes.
      extra: { tokens: tokensFor(it, words, lemmaIds) },
    };
  }),
  grammarPoints: GRAMMAR,
};
