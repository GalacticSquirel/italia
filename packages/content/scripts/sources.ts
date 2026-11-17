/**
 * Every external file the seed pipeline reads. `pnpm fetch` downloads each one into
 * `.cache/` and records its sha256 in `sources.lock.json`; later runs verify the
 * cached file against the lock. Licences are documented in LICENSES.md.
 */
export interface SourceFile {
  /** Stable key used in the lock file and by the pipeline. */
  readonly id: string;
  /** File name inside `.cache/`. */
  readonly file: string;
  readonly url: string;
  /** Short attribution string, also written into the seed's `sources[]`. */
  readonly name: string;
  readonly licence: string;
  readonly homepage: string;
}

const TATOEBA = 'https://downloads.tatoeba.org/exports';
const TATOEBA_NAME = 'Tatoeba (tatoeba.org) weekly export';
const TATOEBA_LICENCE = 'CC-BY-2.0-FR';

export const SOURCES = [
  {
    id: 'frequencywords-it',
    file: 'it_full.txt',
    url: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/it/it_full.txt',
    name: 'FrequencyWords, Italian full list (OpenSubtitles 2018), Hermit Dave',
    licence: 'CC-BY-SA-4.0',
    homepage: 'https://github.com/hermitdave/FrequencyWords',
  },
  {
    id: 'morph-it',
    file: 'morph-it.tgz',
    url: 'https://docs.sslmit.unibo.it/lib/exe/fetch.php?media=resources:morph-it.tgz',
    name: 'Morph-it! 0.4.8, Marco Baroni and Eros Zanchetta',
    licence: 'CC-BY-SA-2.0 OR LGPL-2.1',
    homepage: 'https://docs.sslmit.unibo.it/doku.php?id=resources:morph-it',
  },
  {
    id: 'subtlex-it',
    file: 'subtlex-it.csv',
    url: 'https://osf.io/download/wtr39/',
    name: 'SUBTLEX-IT, Crepaldi, Amenta, Mandera, Keuleers and Brysbaert (2015)',
    licence: 'CC-BY-NC-SA',
    homepage: 'https://osf.io/zg7sc/',
  },
  {
    id: 'kaikki-it',
    file: 'kaikki.org-dictionary-Italian.jsonl',
    url: 'https://kaikki.org/dictionary/Italian/kaikki.org-dictionary-Italian.jsonl',
    name: 'Wiktionary (English edition) Italian entries, extracted by Wiktextract (kaikki.org)',
    licence: 'CC-BY-SA-4.0 AND GFDL-1.3',
    homepage: 'https://kaikki.org/dictionary/Italian/',
  },
  {
    id: 'tatoeba-ita',
    file: 'ita_sentences_detailed.tsv.bz2',
    url: `${TATOEBA}/per_language/ita/ita_sentences_detailed.tsv.bz2`,
    name: TATOEBA_NAME,
    licence: TATOEBA_LICENCE,
    homepage: 'https://tatoeba.org/en/downloads',
  },
  {
    id: 'tatoeba-eng',
    file: 'eng_sentences_detailed.tsv.bz2',
    url: `${TATOEBA}/per_language/eng/eng_sentences_detailed.tsv.bz2`,
    name: TATOEBA_NAME,
    licence: TATOEBA_LICENCE,
    homepage: 'https://tatoeba.org/en/downloads',
  },
  {
    id: 'tatoeba-ita-eng-links',
    file: 'ita-eng_links.tsv.bz2',
    url: `${TATOEBA}/per_language/ita/ita-eng_links.tsv.bz2`,
    name: TATOEBA_NAME,
    licence: TATOEBA_LICENCE,
    homepage: 'https://tatoeba.org/en/downloads',
  },
  {
    id: 'tatoeba-user-languages',
    file: 'user_languages.tar.bz2',
    url: `${TATOEBA}/user_languages.tar.bz2`,
    name: TATOEBA_NAME,
    licence: TATOEBA_LICENCE,
    homepage: 'https://tatoeba.org/en/downloads',
  },
] as const satisfies readonly SourceFile[];

export type SourceId = (typeof SOURCES)[number]['id'];
