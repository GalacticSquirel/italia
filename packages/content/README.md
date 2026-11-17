# @italia/content

Placeholder. In Phase 1 this package becomes the build-time content pipeline that produces the
SQLite seed bundled with the app. Nothing in this package ships to the phone except its output.

## Planned pipeline

1. **Lemmas by frequency.** Merge frequency lists (see [LICENSES.md](./LICENSES.md)) into one
   ranked list of Italian lemmas with part of speech, then add English glosses.
2. **Sentence pairs.** Select Italian-English sentence pairs for each lemma, preferring short,
   natural sentences whose other words are more frequent than the target.
3. **Grammar graph.** Grammar points in acquisition order (present, passato prossimo, imperfetto,
   future, conditional, subjunctive; noun-phrase agreement before subject-verb agreement before
   clitics), each with prerequisites, a short note and tagged example sentences.
4. **HVPT item lists.** Minimal pairs for double consonants, vowels and stress.
5. **Graded stories.** Story series at each level band with lemma-tagged tokens, validated for
   known-word coverage and grammar ceiling.
6. **Seed build.** Validate everything with zod schemas, then write the seed database using the
   app's Drizzle schema (`apps/mobile/src/db/schema.ts`). Every row keeps its `source` and
   `licence`.

## Licences

Every source is tracked in [LICENSES.md](./LICENSES.md). A source may only feed the shipped seed
if its licence allows that use.
