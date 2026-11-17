/**
 * TEST FIXTURE ONLY. Never imported by app code or shipped as content.
 *
 * A tiny graded-stories file in the `stories.v1.json` format, tagged against
 * the fixture seed's lemma ids (see `fixtureSeed.ts`), so reader tests have
 * small, predictable stories. Written for this fixture (CC0).
 */
import type { StoriesFile, StorySentence } from '@italia/content';

type Word = [surface: string, lemmaId: number | null];

/** Build a sentence from words; `null` lemma ids are names. */
function sentence(en: string, words: Word[], end = '.'): StorySentence {
  let it = '';
  const tokens = words.map(([text, lemmaId]) => {
    if (it.length > 0) it += ' ';
    const start = it.length;
    it += text;
    return lemmaId === null
      ? { text, start, end: it.length, lemmaId: null, isName: true as const }
      : { text, start, end: it.length, lemmaId };
  });
  return { it: `${it}${end}`, en, tokens, grammarIds: [] };
}

const MARCO = 'Marco';
const ANNA = 'Anna';

const S = {
  marcoCasa: sentence('Marco is at home.', [
    [MARCO, null],
    ['è', 1],
    ['a', 6],
    ['casa', 11],
  ]),
  casaBella: sentence('The house is very beautiful.', [
    ['La', 2],
    ['casa', 11],
    ['è', 1],
    ['molto', 12],
    ['bella', 16],
  ]),
  marcoMangia: sentence('Marco eats bread and drinks water.', [
    [MARCO, null],
    ['mangia', 23],
    ['il', 2],
    ['pane', 31],
    ['e', 7],
    ['acqua', 32],
  ]),
  gatto: sentence('The cat is small and tired.', [
    ['Il', 2],
    ['gatto', 30],
    ['è', 1],
    ['piccolo', 19],
    ['e', 7],
    ['stanco', 29],
  ]),
  annaLavora: sentence('Anna always works in the city.', [
    [ANNA, null],
    ['lavora', 24],
    ['sempre', 14],
    ['in', 8],
    ['città', 22],
  ]),
  annaLibro: sentence('Anna looks for a big book.', [
    [ANNA, null],
    ['cerca', 25],
    ['il', 2],
    ['libro', 20],
    ['grande', 18],
  ]),
  amico: sentence('The friend speaks Italian today.', [
    ['Il', 2],
    ['amico', 21],
    ['parla', 15],
    ['italiano', 26],
    ['oggi', 13],
  ]),
  caffe: sentence('The coffee is good.', [
    ['Il', 2],
    ['caffè', 33],
    ['è', 1],
    ['buono', 17],
  ]),
};

function story(
  seriesId: string,
  seriesIndex: number,
  titleIt: string,
  titleEn: string,
  sentences: StorySentence[],
  targetLemmaIds: number[],
): StoriesFile['stories'][number] {
  return {
    id: `${seriesId}-${String(seriesIndex).padStart(2, '0')}`,
    seriesId,
    seriesIndex,
    level: 'A1',
    band: 150,
    title: { it: titleIt, en: titleEn },
    paragraphs: [{ sentences }],
    targetLemmaIds,
    grammarIds: [],
    wordCount: sentences.reduce((n, s) => n + s.tokens.length, 0),
  };
}

/** The fixture stories file: two series of two episodes. */
export const FIXTURE_STORIES: StoriesFile = {
  version: 1,
  seedSha256: '0'.repeat(64),
  series: [
    {
      id: 'casa-di-marco',
      title: { it: 'La casa di Marco', en: "Marco's house" },
      band: 150,
      blurb: 'Marco at home with his cat.',
    },
    {
      id: 'anna-in-citta',
      title: { it: 'Anna in città', en: 'Anna in the city' },
      band: 150,
      blurb: 'Anna works in the city.',
    },
  ],
  stories: [
    story(
      'casa-di-marco',
      1,
      'A casa',
      'At home',
      [S.marcoCasa, S.casaBella, S.marcoMangia, S.gatto],
      [31, 32, 30],
    ),
    story('casa-di-marco', 2, 'Il gatto', 'The cat', [S.gatto, S.marcoCasa, S.casaBella], [29]),
    story(
      'anna-in-citta',
      1,
      'Il lavoro',
      'Work',
      [S.annaLavora, S.annaLibro, S.amico, S.caffe],
      [24, 25, 20],
    ),
    story('anna-in-citta', 2, 'Il libro', 'The book', [S.annaLibro, S.amico], [26]),
  ],
};
