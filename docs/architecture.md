# Italia: architecture

Italia is a personal, local-first Android (and iOS) app for learning Italian from zero toward
general fluency. Everything that involves AI runs on the phone; the only server is a Supabase
instance used for sign-in and syncing learning records. This document describes the system as
built. Decisions and their reasons are in [`adr/`](adr/); subsystem details are in
[`speech.md`](speech.md), [`sync.md`](sync.md), [`../training/README.md`](../training/README.md)
and [`../models/README.md`](../models/README.md).

## 1. What the app does

The research (see the project's research reports) points to a small set of methods that work:
spaced retrieval practice, production over recognition, a large volume of comprehensible input,
frequency-ordered vocabulary, grammar taught in acquisition order with explicit explanation, and
early, frequent speaking with feedback. The app turns that into one guided path through each day,
so the learner never has to choose what to do next (Owen studies about an hour a day):

- **Today**: the day's path, with one "Up next" step at the top and one button to start it. The
  steps come in a fixed order (`buildDailyPath` in `packages/core`): due reviews; new words in
  frequency order (about 20 a day by default) with grammar points as they unlock; a story that
  reuses them (ear training until the first story fits); speaking (the cue-pause-answer drill, or
  shadowing before there are spoken prompts); and a scenario conversation with the on-device tutor
  once about 150 words are known and the model is downloaded. Finishing a step hands over to the
  next one; a step can be skipped for the day; reviews that come due later are offered as extra
  practice once the path is done.
- **Practice**: everything for extra time or a particular need: the story library (graded stories
  in series at eight vocabulary bands, with synced audio, tap-to-translate, add-to-reviews and
  comprehension questions), every speaking exercise (conversation, drill, hands-free drill, ear
  training on minimal pairs, shadowing with a pronunciation score), My words (browse and search
  every card) and the grammar guide (114 points from A1 to C2, each with an explanation and drills).
- **Progress**: known words, hours, CEFR estimate, review load forecast and a calendar.

It works offline and signed out. Signing in only adds sync between devices.

## 2. Technology

| Area                  | Choice                                                                                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App                   | Expo SDK 58, React Native 0.88, TypeScript strict, Expo Router, React Compiler; a development build (Expo Go cannot load the native modules)                     |
| Local data            | expo-sqlite with Drizzle ORM and generated migrations                                                                                                            |
| UI state              | Zustand stores, React context for services                                                                                                                       |
| Scheduling            | FSRS through `ts-fsrs` 6, wrapped by `@italia/core`                                                                                                              |
| Tutor model           | Gemma 4 E4B or E2B (instruction-tuned, Q4_0 GGUF) through `llama.rn`; the llama.cpp engine build that fits the phone's CPU is downloaded on demand (`models/`)   |
| Speech to text        | Parakeet TDT 0.6B v3 (int8) through `react-native-sherpa-onnx`; the phone's on-device recognizer as a fallback                                                   |
| Italian voice         | Piper `it_IT-paola-medium` through sherpa-onnx; the phone's Italian voice as a fallback                                                                          |
| Pronunciation scoring | Our own: wav2vec2 Italian phonemizer (ONNX, `onnxruntime-react-native`), CTC decoding, then G2P, alignment and per-phoneme scores in `@italia/speech`             |
| Accounts and sync     | Self-hosted Supabase (Auth and Postgres with row-level security), tables in the `italia` schema                                                                  |
| Builds                | GitHub Actions builds release APKs for arm64 phones and x86_64 emulators and publishes both as the `android-latest` release; EAS profiles remain for development builds |
| Tests                 | Vitest in `packages/*` and `supabase/`, jest-expo with React Native Testing Library in the app, pytest for `training/`                                           |

Model files are not bundled in the app. They are listed in `models/manifest.json` with SHA-256
checksums, hosted on Hugging Face, and downloaded from Settings, On-device models. Each model has
a minimum RAM tier, so phones that cannot run the tutor still get everything else.

## 3. Repository layout

```
apps/mobile/            The Expo app
  src/app/              Routes (Expo Router): tabs Today, Practice, Progress; session, read,
                        words, story, word, grammar, speak, models, settings, auth callback
  src/features/         One folder per screen area (today, practice, study, session, review, read,
                        speak, converse, grammar, progress, settings, account, models, navigation)
  src/data/             Repositories over the database, seed and story import, backup and restore
  src/db/               Drizzle schema, client, DatabaseProvider (runs migrations)
  src/speech/           Recording, speech to text, Italian voice, pronunciation analysis
  src/tutor/            llama.rn conversation partner, model choice, battery and thermal limits
  src/models/           Model manifest, tiers, downloads and verification
  src/sync/             Supabase auth, sync engine, local store adapters
  src/ui/               Design system: tokens, ThemeProvider and components
  drizzle/              Generated SQL migrations (committed)
  plugins/              Expo config plugins for native build settings
packages/core/          Learning logic in pure TypeScript: scheduler, grading, sessions, the daily
                        path, streaks, progress, CEFR, story selection, comprehension checks, the
                        tutor contract
packages/content/       Build-time content pipeline and the bundled seed and stories
packages/speech/        Italian pronunciation rules, phoneme inventory, alignment and scoring
packages/api-contract/  zod schemas for every row that syncs
supabase/               Migrations, row-level security tests, local config
training/               Python (uv) pipeline for the tutor model: spec, scenarios, dialogue data,
                        SFT and DPO, evaluation, GGUF export
models/                 Model manifest and scripts that publish model files
docs/                   This document, subsystem notes and ADRs
```

Packages ship TypeScript source with no build step and export their public API from
`src/index.ts`. `packages/*` never import React, React Native or Expo (ESLint enforces it).

## 4. Data

The app's SQLite database (`apps/mobile/src/db/schema.ts`):

- Content, imported from the bundled seed on first launch and on seed upgrades: `lemma` (3,000
  most frequent lemmas with part of speech, rank and gloss), `sentence` (about 14,400
  Italian-English pairs from Tatoeba, chosen so each teaches one new word), `grammar_point` (114,
  with prerequisites and notes) and `story` (120 graded stories in 24 series).
- Learning records: `card` (kind, target, prompt mode and FSRS state), `review_log`
  (**append-only**, the source of truth: card state can always be rebuilt by replaying logs),
  `error_record` and `learner_sentence` (corrections from conversations), `story_progress`,
  `lemma_exposure`, `study_session`, `streak_state` and `settings`.
- Device state: `app_meta` (imported seed versions, sync cursors) and `model_file` (downloads).

Card kinds: `recognition` (first exposure), `cloze_production`, `sentence_production`,
`dictation`, `grammar_cloze`, `grammar_drill` and `spoken_prompt`. Ear training is adaptive and
not scheduled by FSRS.

Ids are stable: lemma ids are a hash of `lemma|POS`, sentence ids are Tatoeba ids, corrected
sentences get negative ids derived from their text, and card ids are derived from kind, target and
prompt mode, so two devices create the same card for the same item.

## 5. Key algorithms (all in `packages/core`)

- **Grading**: answers are normalised (case, punctuation, apostrophes, elision spacing); an
  accent-only difference is accepted but flagged; small typos (about one per eight characters)
  rate Hard; wrong is Again; fast and correct is Easy, with latency thresholds per card kind.
  Spoken answers are graded on the transcript; the pronunciation score is shown separately and
  never changes a rating.
- **Session builder**: due reviews first, interleaved by kind and grammar point, then new items up
  to the daily limit, throttled when the projected review load exceeds the time budget or recent
  accuracy drops. The day's study runs as two sessions, reviews and then new items; spoken
  prompts are left to the speaking drill.
- **Daily path**: today's steps from what is due, ready and already done (activities recorded on
  study sessions), with the first unfinished step as the one to do now. See section 1. The curriculum (which new items are eligible, in which order) is built in
  `apps/mobile/src/features/study` from the imported content.
- **Known words and coverage**: a lemma is known when its card's retrievability is at least 0.9
  and its stability at least 7 days. Story coverage is known tokens over content tokens,
  excluding names; the reader suggests stories in the 95 to 98% window.
- **CEFR estimate**: known lemmas, unlocked grammar and speaking results mapped to bands, shown as
  a range.
- **Tutor contract**: the tutor's system prompt, output JSON schema, error tags, level bands and
  scenarios are defined once in `training/spec`, and `python -m spec export-schema` generates
  `packages/core/src/tutor/spec.generated.ts` from them (the training CI job fails if it is stale,
  so a spec change cannot land without it). Every tutor reply is
  parsed and checked against the learner's message before its corrections are shown or saved.

## 6. Security and privacy

- No AI request, recording or transcript leaves the phone. Recordings are processed and
  discarded locally.
- Only learning records sync. Every synced row is validated with `packages/api-contract` and
  protected by row-level security; the app holds only the public anon key.
- Model files are verified against the SHA-256 in the manifest before they are loaded.
- Backup and restore to a file work without an account.

## 7. Status

Built: everything in section 1, sync, the APK build, model hosting and the training pipeline.

In progress: native-speaker audio packs for lessons and stories (`audio/`), more stories and a
10,000-lemma seed reaching B2 to C2, hand-written tutor dialogues at every level, and the first
fine-tuning runs of the tutor model on Owen's Mac Studio with a local teacher model.

Not started: onboarding and placement test, reminders, an end-to-end test suite, and a
performance and battery pass on a real phone. There is no store release; the app is installed
from the APK.
