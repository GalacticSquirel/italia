# Content sources and licences

Every file the seed pipeline downloads is listed in `scripts/sources.ts`; its sha256, size and
first download date are pinned in `sources.lock.json`, and copied into the seed's `sources[]`.
Italia is a personal, non-commercial app, so share-alike and non-commercial sources are
acceptable for now. **If the app is ever sold, the non-commercial sources below must be replaced
or licensed.**

## Used in seed v1

| Source (lock id)                                                                  | Version used                                                       | Used for                                                                  | Licence                                                     |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------- |
| FrequencyWords, Italian `it_full.txt` by Hermit Dave (`frequencywords-it`)        | 2018 list from OpenSubtitles 2018; sha256 `b23b0c6a…`              | Word-form frequencies; lemma ranks after lemmatisation; coverage figures  | Data CC BY-SA 4.0 (code MIT)                                |
| Morph-it! by Marco Baroni and Eros Zanchetta (`morph-it`)                         | 0.4.8 (`morph-it_048.txt`); sha256 `b137343d…`                     | Form to lemma, part of speech, noun gender, verb tense and person         | Dual CC BY-SA 2.0 or LGPL (we use it under CC BY-SA 2.0)    |
| SUBTLEX-IT, Crepaldi, Amenta, Mandera, Keuleers and Brysbaert 2015 (`subtlex-it`) | OSF `zg7sc`, file `subtlex-it.csv`; sha256 `f6b47ece…`             | Part-of-speech split of ambiguous forms (no data is copied into the seed) | **CC BY-NC-SA** (non-commercial; per the OSF `license.txt`) |
| Wiktionary Italian entries via Wiktextract / kaikki.org (`kaikki-it`)             | kaikki.org extract of 2026-10-30; sha256 `f112deb9…`               | English glosses (shortened)                                               | CC BY-SA 4.0 and GFDL (Wiktionary text)                     |
| Tatoeba weekly export (`tatoeba-ita`, `tatoeba-eng`, `tatoeba-ita-eng-links`)     | Export of 2026-11-14 (per-language detailed files and it-en links) | Italian sentences and English translations                                | CC BY 2.0 FR                                                |
| Tatoeba `user_languages` (`tatoeba-user-languages`)                               | Export of 2026-11-14                                               | Prefer sentences by native speakers (not copied into the seed)            | CC BY 2.0 FR                                                |

Hand-written content in this package (grammar notes in `src/grammar/points.ts`, gloss overrides
and corrections in `src/pipeline/overrides.ts`) is original to this project.

## Graded stories

The graded stories in `stories/` (sources, tagged files and the bundled `seed/stories.v1.json`),
their English translations and the series descriptions are **original works written for this
project and owned by it**. No third-party text is used. Their token tags are seed lemma ids
assigned with the Morph-it! lexicon (CC BY-SA 2.0, above); the tags point into the seed's lemma
list rather than copying Morph-it! data. The stories may be relicensed by the project as it
chooses.

## Attribution in the seed

- Each sentence row keeps `source` = `tatoeba:<Italian sentence id>` and `licence` =
  `CC-BY-2.0-FR`; `extra` keeps the English sentence id and both contributors' usernames. A
  sentence's page is `https://tatoeba.org/en/sentences/show/<id>`.
- Lemma glosses are derived from Wiktionary (CC BY-SA), and lemma ranks from FrequencyWords and
  Morph-it! (CC BY-SA), so **the lemma list in the seed is a CC BY-SA derivative** and must be
  shared under CC BY-SA with attribution if it is ever distributed.
- The app's attributions screen should list every source above.

## Ear-training clips (built locally, not bundled yet)

| Source                                                       | Version used                                            | Used for                                                                  | Licence |
| ------------------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------- | ------- |
| Mozilla Common Voice, Italian (`validated.tsv` and `clips/`) | Any release; the pack records which (`dataset.release`) | Real speakers saying minimal-pair words, for ear training (`build:clips`) | CC0-1.0 |

Common Voice is now distributed through the Mozilla Data Collective, which needs an account and
acceptance of the dataset terms, so `scripts/build-clips.ts` reads a local copy and never
downloads it. It has not been run for this repository yet: the app's ear training uses the
phone's own Italian voices until a pack is built (the screen says "Limited voices"). Pack audio
is never committed (`packages/content/build/` is ignored). CC0 needs no attribution, but the
manifest keeps each clip's source file name.

## Not used (yet)

| Source                                                 | Why not                                                                      | Licence                          |
| ------------------------------------------------------ | ---------------------------------------------------------------------------- | -------------------------------- |
| Nuovo vocabolario di base della lingua italiana (NVdB) | Planned for CEFR / "alta disponibilità" tagging in a later seed              | Research and personal use only   |
| wordfreq                                               | FrequencyWords covers the same subtitle register; may be used to cross-check | Data CC BY-SA 4.0                |
| Universal Dependencies Italian ISDT                    | Not needed: Morph-it! provides lemmas and tags                               | Non-commercial (CC BY-NC-SA 3.0) |

## Notes

- CC BY-SA data requires attribution, and derived datasets must be shared under the same licence.
- CC BY 2.0 FR requires attribution (Tatoeba asks for a link to the sentence or its author).
- SUBTLEX-IT is CC BY-NC-SA: it only influences how ambiguous form counts are split; none of
  its rows are copied into the seed, but the derived ranks would still need review before any
  commercial use.
