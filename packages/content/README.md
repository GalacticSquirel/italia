# @italia/content

Build-time content pipeline and the content seed it produces: lemmas, sentences, grammar points and
the bundled graded stories. Only the seed files and their schemas ship to the phone; the pipeline
runs on a development machine.

## What is in the seed

`seed/seed.v1.json` (committed, about 18 MB) has the shape
`{ version, generatedAt, sources[], lemmas[], sentences[], grammarPoints[] }`:

- **lemmas**: the 10,000 most frequent Italian lemmas with part of speech (Universal POS), rank and
  a short English gloss. About 560 everyday words that subtitles underrate (months, numbers,
  food, family, school, home) are ranked within their CEFR level (see Pipeline step 3).
- **sentences**: about 36,000 Italian-English pairs from Tatoeba, 3 to 12 words, chosen per lemma
  so that the target is the rarest word in the sentence (n+1), up to 5 per lemma.
- **grammarPoints**: 114 hand-written grammar points from A1 to C2 in acquisition order
  (`src/grammar/levels/`), with prerequisites, an explanation and drills. Sentences carry the ids of the grammar
  points simple rules detect in them.

Row fields match the insert types of the `lemma`, `sentence` and `grammar_point` tables in
`apps/mobile/src/db/schema.ts`. Fields the tables do not have yet are in each row's `extra`
object (noun gender, frequency per million, token-to-lemma alignment, sentence target and
difficulty, Tatoeba attribution, grammar slug and CEFR band). `seed/build-report.json` holds the
build statistics (coverage, merged variant spellings, rejected sentences, grammar tag counts), and
`seed/top-forms.json` records which seed lemma each of the 300 most frequent subtitle word forms
maps to.

The 10,000 lemmas cover about 93% of subtitle tokens (83% for the top 1,000, 89% for the top
3,000, 91% for the top 5,000).

Ids are stable across rebuilds: lemma ids are a 31-bit hash of `lemma|POS`, sentence ids are the
Tatoeba ids, and grammar ids are fixed in `src/grammar/points.ts`. `generatedAt` only changes
when the content does.

## Using it

```ts
import { parseSeed, toRows } from '@italia/content';
import seedJson from '@italia/content/seed.v1.json';

const seed = parseSeed(seedJson); // zod-validated
const { lemmas, sentences, grammarPoints } = toRows(seed); // rows without `extra`
```

In Node, `loadSeedFile()` from `@italia/content/node` reads and validates the committed file.

The mobile app does not import the JSON into its JS bundle: `apps/mobile/scripts/sync-seed-asset.js`
copies it to a `.seed` asset that the app reads and validates on first launch (see
`apps/mobile/src/data/seed/`).

## Rebuilding

Needs Node, network access, and the `tar` and `bzip2` commands.

```sh
pnpm --filter @italia/content build:seed            # fetch (if needed), verify, build
pnpm --filter @italia/content fetch:sources         # only download and verify sources
pnpm --filter @italia/content build:seed --refresh  # re-download and accept new versions
pnpm --filter @italia/content test                  # validate the seed and pipeline
```

Sources (about 900 MB, mostly the Wiktionary extract) are cached in `.cache/` (git-ignored).
Their sha256 digests are pinned in `sources.lock.json`; a rebuild fails if a cached or
re-downloaded file differs, because Tatoeba and kaikki.org publish new versions in place. Run
with `--refresh` to accept the new versions, then review the seed diff. A build takes about a
minute and needs roughly 4 GB of memory.

## Pipeline

1. **Lexicon**: Morph-it! forms, normalised (articles to `il`/`un`, articulated prepositions
   split into preposition + `il`, clitics canonicalised, auxiliaries as VERB, inflected pronoun
   lemmas such as `mia` and `altri` given their determiner lemma), plus corrections in
   `src/pipeline/overrides.ts`. A form that is only a name in Morph-it! (`po`, `gia`) also gets
   the common word it is usually typed for (`po'`, `già`).
2. **Lemma frequencies**: FrequencyWords form counts shared between each form's readings, using
   SUBTLEX-IT's tag distribution and a few rounds of re-estimation. Noun and adjective lemmas
   that only exist as a misreading of one frequent form (`vaio` from "vai", `malo` from "male")
   are removed first. Homographs with the same spelling are merged, and lemmas that only borrow
   another word's form are dropped.
3. **Glosses**: the first usable Wiktionary senses for the matching part of speech. Variant
   spellings (apocopic `buon`, `bel`, euphonic `ed`, `ad`) are merged into their base lemma, and
   each merged group takes the part of speech that has a gloss. Lemmas without a gloss,
   profanity and mostly vulgar words are dropped. Lemmas are ranked by frequency, except that the
   hand-picked everyday words in `src/pipeline/everyday.ts` move up, as little as needed, to
   their level's rank ceiling (A1 500, A2 1,500, B1 3,000, B2 5,000): subtitles rarely say
   "gennaio", "forchetta" or "nuora", but learners need them early. Everyday nouns Morph-it!
   lacks (`aglio`, `noce`, `capra`) are added in `overrides.ts`.
4. **Sentences**: Tatoeba it-en pairs are tokenised and tagged with a small rule-based tagger.
   Sentences with unknown words, digits, more than two names or subjunctive / passato remoto
   forms are skipped. Each lemma gets up to 5 anchor sentences ranked by native-speaker
   authorship, length and translation sanity; lemmas that are never the rarest word get 2 of the
   easiest sentences containing them.
5. **Grammar**: `src/grammar/points.ts` (hand-written) and `src/grammar/rules.ts` (detection).
6. **Validation**: the seed is parsed with the zod schema before it is written, and
   `src/seed.test.ts` checks ids, the prerequisite DAG, coverage and size, that about 120
   must-have words are present within a rank limit, that every everyday word is within its
   level ceiling, and that every one of the top 300 word
   forms maps to a seed lemma, is a name, or is listed in `EXCLUDED_TOP_FORMS` with a reason.

## Graded stories

`stories/` holds the bundled story corpus: original Italian stories written for the project, in
series with a recurring cast (Via Verdi and its neighbours), each sentence with an English
translation. The app picks stories at 95 to 98% known-word coverage (`docs/architecture.md`, section
5), so every token is tagged with a seed lemma id.

| Path                           | What it is                                                                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stories/<series>/series.json` | Series id, title, band and blurb (hand-written)                                                                                                    |
| `stories/<series>/<nn>.txt`    | The story source (hand-written), format below                                                                                                      |
| `stories/<series>/<nn>.json`   | The tagged story (generated, `StorySchema`)                                                                                                        |
| `stories/index.json`           | Every series and story with band, level and word count (generated)                                                                                 |
| `seed/stories.v1.json`         | The bundle the app imports: all series and stories plus the sha256 of the `seed.v1.json` they were tagged against (generated, `StoriesFileSchema`) |
| `seed/manifest.json`           | sha256 and size of `seed.v1.json` and `stories.v1.json` (generated)                                                                                |

A source file has a `title:` line (`Italian | English`), an optional `names:` line listing the
proper nouns, then one sentence per line as `Italian | English`, with blank lines between
paragraphs. Use the ASCII apostrophe.

```text
title: Chi è? | Who is he?
names: Luca, Sara

Al lavoro, Luca parla con Sara. | At work, Luca talks to Sara.
```

A `questions:` line ends the story text and starts its multiple-choice comprehension questions:
a `?` line per question, then its options, the right one marked `*` and the others `-`. Every story
has 3 to 6 questions (we write 4 with 3 options). Questions are tagged like sentences, so the reader
can offer tap-to-translate on them; their words must be within the next band's ceiling (or a name
from the story's `names:`) and their grammar within the band's ceiling. Options are stored in
authored order with the index of the right one, and the app shuffles them.

```text
questions:
? Con chi parla Luca? | Who is Luca talking to?
- Con il capo. | To the boss.
* Con Sara. | To Sara.
- Con un amico. | To a friend.
```

### Bands

A story's **band** is a lemma-rank ceiling (150, 300, 500, 750, 1000, 1500, 2000, 3000, 4000,
5000, 6500, 8000, 10000). The
validator (`src/stories/validate.ts`) requires, per story:

- at least **98%** of word tokens (names excluded) with every lemma ranked within the band, the
  rest from the next band only (so at most 2%), and no untagged or unknown words;
- names at most 12% of tokens;
- no grammar point above the band's ceiling (subjunctive and passato remoto forms count as their
  grammar points, so they appear from B1 and B2 on);
- a length and a longest sentence that grow with the band;
- 3 to 6 comprehension questions (see above);
- 3 to 6 **target lemmas**: content words above the previous band's ceiling (and above rank 20)
  that the story uses at least twice. The tagger picks them, preferring words earlier episodes of
  the series have not targeted.

| Band  | Level | Grammar allowed up to (point order)                                     | Words   | Longest sentence |
| ----- | ----- | ----------------------------------------------------------------------- | ------- | ---------------- |
| 150   | A1    | `piacere` (24): the present-tense A1 core                               | 80-140  | 10               |
| 300   | A1    | `piacere` (24)                                                          | 100-170 | 12               |
| 500   | A1    | `passato-prossimo-essere` (27): passato prossimo                        | 120-200 | 14               |
| 750   | A2    | `indirect-object-pronouns` (36): reflexives, object pronouns            | 150-240 | 16               |
| 1000  | A2    | `passato-prossimo-vs-imperfetto` (41): imperfetto                       | 170-270 | 18               |
| 1500  | A2    | `comparatives` (50): future, stare + gerund, imperative, comparatives   | 200-300 | 20               |
| 2000  | B1    | `infinitive-past` (69): ci, ne, conditional, double pronouns, relatives | 230-330 | 24               |
| 3000  | B1    | `subjunctive-past` (76): all of B1, incl. present and past subjunctive  | 250-350 | 28               |
| 4000  | B2    | `si-passivante` (86): imperfect subjunctive, hypotheticals, come se     | 280-400 | 30               |
| 5000  | B2    | `altered-nouns` (93): passato remoto, reported speech, causative fare   | 300-450 | 32               |
| 6500  | C1    | `formal-register` (104): participle clauses, hearsay conditional        | 320-500 | 36               |
| 8000  | C1    | `adjective-position` (108): discourse markers, nominalisation           | 350-550 | 40               |
| 10000 | C2    | `tense-stylistics` (114): the whole syllabus                            | 380-600 | 45               |

Grammar is detected with the same rules as the seed sentences (`src/grammar/rules.ts`). They are
precise rather than complete, so writers also follow the ceiling by hand (for example no "Lo so"
before band 750). Informal _tu_ is used throughout; formal _Lei_ appears from band 750.

### Tagging

`src/stories/tagger.ts` tokenises each sentence and tags it with the Morph-it! lexicon, so elision
("l'acqua", "dell'", "c'è"), articulated prepositions ("nel" = in + il) and enclitics ("dimmi" =
dire + mi, "alzarsi" = alzare + si) map to seed lemmas. A token has the head lemma in `lemmaId`
and further lemmas in `partIds`. Variant spellings the seed folded into a base word (`ed`, `ad`,
`po'`, `buon`, `bel`, `qual`, `anch'`; listed in `seed/build-report.json`) map to that word.
Compound numerals are read as their parts ("ventotto" = venti + otto, "duemilasei" = due +
mille + sei, `src/pipeline/numerals.ts`), so any number is in band once its parts are, and "sei"
after an article or a number or before a noun ("alle sei", "sei anni") is the number, not the
verb. Tokens listed under `names:` are marked `isName` even when they
are also words ("Rosa", "Bruno"); a capitalised word that is neither is reported.

`wordTimings` is filled by the audio phase and stored in the `story.word_timings` column: one
array per sentence in reading order, with one `[startMs, endMs]` pair per token
(`StoryWordTimingsSchema`). Use `toStoryRow()` to map a story to a `story` table row.

### Building and checking

```sh
pnpm --filter @italia/content build:stories                 # tag, validate, write everything
pnpm --filter @italia/content build:stories --only via-verdi --verbose   # iterate on one series
```

Stories are tagged against the committed seed and record its checksum, so after `build:seed`
always run `build:stories` too (in that order); `corpus.test.ts` fails otherwise.

The build needs `morph-it` and `subtlex-it` in `.cache/` (`fetch:sources`) and exits non-zero
when a story fails; fix the story rather than the thresholds. `--verbose` also lists each
story's grammar points, its target words and any `homograph:` the tagger read as a rarer lemma
although the same spelling is a commoner word ("insegna = insegna NOUN #4051 (also insegnare
VERB #592)"); check those by hand. When the reading is wrong, pin it with a `readings:` header after
`names:` (`readings: costa=costare, urla=urlare`), which applies to the whole story and its
questions; a pin that matches no word is reported. `src/stories/corpus.test.ts` checks
that every committed story validates, matches its source, is in the index and the bundle, and
that the checksums in the manifest are current; with the cache present it also re-tags the sources
and compares.

Licences for every source are in [LICENSES.md](./LICENSES.md).
