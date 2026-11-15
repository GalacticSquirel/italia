# @italia/content

Build-time content pipeline and the content seed it produces. Only the seed and its schema ship to
the phone; the pipeline runs on a development machine.

## What is in the seed

`seed/seed.v1.json` (committed, about 7 MB) has the shape
`{ version, generatedAt, sources[], lemmas[], sentences[], grammarPoints[] }`:

- **lemmas**: the 3,000 most frequent Italian lemmas with part of speech (Universal POS), rank and
  a short English gloss.
- **sentences**: about 14,000 Italian-English pairs from Tatoeba, 3 to 12 words, chosen per lemma
  so that the target is the rarest word in the sentence (n+1), up to 5 per lemma.
- **grammarPoints**: 38 hand-written A1-A2 (and first B1) grammar points in acquisition order,
  with prerequisites and a short note with examples. Sentences carry the ids of the grammar
  points simple rules detect in them.

Row fields match the insert types of the `lemma`, `sentence` and `grammar_point` tables in
`apps/mobile/src/db/schema.ts`. Fields the tables do not have yet are in each row's `extra`
object (noun gender, frequency per million, token-to-lemma alignment, sentence target and
difficulty, Tatoeba attribution, grammar slug and CEFR band). `seed/build-report.json` holds the
build statistics (coverage, rejected sentences, grammar tag counts).

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
   split into preposition + `il`, clitics canonicalised, auxiliaries as VERB), plus corrections
   in `src/pipeline/overrides.ts`.
2. **Lemma frequencies**: FrequencyWords form counts shared between each form's readings, using
   SUBTLEX-IT's tag distribution and a few rounds of re-estimation; homographs with the same
   spelling are merged, and lemmas that only borrow another word's form are dropped.
3. **Glosses**: the first usable Wiktionary senses for the matching part of speech; lemmas
   without a gloss, profanity and mostly vulgar words are dropped.
4. **Sentences**: Tatoeba it-en pairs are tokenised and tagged with a small rule-based tagger.
   Sentences with unknown words, digits, more than two names or subjunctive / passato remoto
   forms are skipped. Each lemma gets up to 5 anchor sentences ranked by native-speaker
   authorship, length and translation sanity; lemmas that are never the rarest word get 2 of the
   easiest sentences containing them.
5. **Grammar**: `src/grammar/points.ts` (hand-written) and `src/grammar/rules.ts` (detection).
6. **Validation**: the seed is parsed with the zod schema before it is written, and
   `src/seed.test.ts` checks ids, the prerequisite DAG, coverage and size.

Licences for every source are in [LICENSES.md](./LICENSES.md).
