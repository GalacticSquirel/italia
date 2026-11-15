# Italia: architecture and phased build plan

Status: draft, 2026-11-15. Defaults marked **(default)** are my recommendation and will change if Owen's answers rule them out.

## 1. What the app does (from the research)

One daily session of about 15 to 25 minutes, built automatically, mixing:

1. **Reviews** scheduled by FSRS (ts-fsrs, desired retention 0.90). Production first: you produce the Italian (typed or spoken), not just recognise it. Confusable grammar is interleaved. Target accuracy around 85%.
2. **New words** in frequency order, each anchored in a real sentence (sentence cloze cards), capped per day with a projected review-load display.
3. **Grammar** unlocked in acquisition order (present, passato prossimo, imperfetto, future, conditional, subjunctive; noun-phrase agreement before subject-verb agreement before clitics), each with a short explicit note plus structured-input practice, then spaced cloze items.
4. **Input**: an AI-written graded story at 95 to 98% known-word coverage, with neural TTS, a synced transcript, and tap-to-translate. Tapped words go straight into the review queue.
5. **Speaking, every session**: Pimsleur-style prompt, pause, answer drills (scheduled by FSRS, scored); HVPT ear training with many voices for double consonants, vowels and stress; shadowing with record and compare; later, AI conversation scenarios with prompt-then-recast feedback whose errors feed back into reviews.
6. **Honest progress**: words known, hours studied, estimated CEFR level, projected hours to the next level. Forgiving streak with freezes and repair that counts real study. No hearts, gems or leagues.
7. **Audio-only mode** (hands-free, Pimsleur-like) for walking and commuting.

## 2. Technology choices (fully on-device: no cloud AI at runtime)

Owen's decision (2026-11-15): the app runs fully on the phone. No API keys, no per-use cost, works in airplane mode.

| Area | Choice | Why |
|---|---|---|
| App | **Expo SDK 58, React Native 0.88, TypeScript strict, Expo Router, dev build (not Expo Go)** | One codebase; native modules for the on-device models |
| Local data | **expo-sqlite + Drizzle ORM** with versioned migrations | Offline first; typed queries |
| UI state | **Zustand** | Small and testable |
| Scheduling | **ts-fsrs 6** | Best-performing open scheduler |
| Audio | **expo-audio** (playback, recording) | First-party module |
| LLM (conversation, story generation, glosses, error explanations) | **llama.cpp via `llama.rn`**, running a small open instruction model (Qwen3 or Gemma 3n class, 1.5 to 4B parameters, 4-bit GGUF, roughly 1 to 2.5 GB). Phase 5 adds our own LoRA fine-tune for Italian tutoring (level-controlled replies, recasts, error tags) | Best supported on-device LLM runtime in React Native; uses Metal on iOS and CPU or GPU on Android |
| Speech to text | **whisper.cpp via `whisper.rn`** (multilingual small or base model), with the OS on-device recognizer (`expo-speech-recognition`) as a light fallback | Works offline on both platforms |
| Text to speech | **Neural voices bundled as audio** for all fixed content (generated at build time, see 2a), plus **on-device neural TTS (Piper Italian voices via sherpa-onnx)** for generated text, with OS voices as fallback | Natural audio offline; several voices for ear training |
| Pronunciation scoring | **Our own scorer**: rule-based Italian grapheme-to-phoneme (Italian spelling is very regular), a phoneme-recognition CTC model (wav2vec2 XLS-R class, quantized ONNX via `onnxruntime-react-native`), forced alignment and goodness-of-pronunciation scores per phoneme, plus explicit checks for double consonants (closure duration), stress and vowel quality | No off-the-shelf on-device Italian scorer exists; this is the standard research approach |
| Models delivery | Downloaded once after install (Wi-Fi, resumable, checksum-verified), not inside the app binary | Store size limits; users on older phones can skip them |
| Errors | Sentry (crash reports only, opt-in) | Production visibility without sending learning data |
| Tests | Vitest for pure logic; jest-expo + React Native Testing Library; Maestro end-to-end | |
| CI/CD | GitHub Actions; EAS Build | |

### 2a. Build-time content (generated once by us, bundled, no runtime cloud)

Fixed content is produced offline by a content pipeline we run during development and shipped inside the app or its first download: lemma glosses, example sentences, grammar notes, a large pool of graded stories in series at every level band, and their audio in several voices. At runtime the app picks stories from that pool by your known-word coverage (95 to 98%), and the on-device LLM writes extra stories when the pool runs dry, validated against the same coverage check. The pipeline may use a large model and cloud TTS during development; that never ships to the phone. Owen confirmed this is acceptable (2026-11-15), and that a large model download is fine.

### 2b. Honest limits

- **Device requirements**: the conversation partner and on-device story writing need roughly 6 GB of RAM or more (iPhone 15 Pro or newer; recent mid-to-high-end Android). Older phones still get everything else: reviews, bundled stories, drills, ear training, speaking drills with transcription.
- **Conversation quality**: a 2 to 4B model is much weaker than a cloud model. It will make occasional Italian mistakes and lose the thread in long chats. Mitigations: short structured scenarios, constrained prompts, our fine-tune, and every correction is checked against rules before it is shown.
- **Pronunciation scoring** will be less accurate than Azure's. We will validate it against labelled recordings and show scores as guidance, never as a gate.
- **Storage and battery**: about 2 to 3 GB for all models; long conversations warm the phone.

## 3. Repository layout (pnpm workspaces monorepo)

```
apps/mobile/            Expo app (screens, components, platform code only)
packages/core/          Pure TypeScript, no React: scheduler wrapper, answer grading,
                        session builder, coverage maths, progress and CEFR estimate,
                        streak rules. 100% unit tested.
packages/content/       Content schema (zod), the build pipeline that produces the
                        bundled SQLite seed: lemmas by frequency, sentence pairs,
                        grammar graph, HVPT item lists. Licences tracked per source.
packages/api-contract/  zod schemas for sync DTOs shared by app and Supabase functions
supabase/               migrations, RLS policies, sync function
packages/speech/        On-device pronunciation scoring: Italian G2P, alignment,
                        GOP and geminate/stress checks (pure TS parts tested in Node)
packages/content/       (above) also holds the build-time generation scripts
models/                 Model manifest (URLs, sizes, checksums, licences); no weights in git
docs/                   this plan, ADRs, content licences
```

The rule: learning logic lives in `packages/core` and never imports React or Expo. Screens call it. That keeps the hard part testable and lets several agents work in parallel without collisions.

## 4. Data model (local SQLite, mirrored in Postgres for sync)

- `lemma` (id, lemma, pos, freq_rank, gloss_en, audio_ref)
- `sentence` (id, it, en, lemma_ids, grammar_ids, source, licence)
- `grammar_point` (id, title, order, prerequisite_ids, note_md)
- `card` (id, kind, target_id, prompt_mode, fsrs fields: due, stability, difficulty, reps, lapses, state)
- `review_log` (id, card_id, rating, answer, latency_ms, reviewed_at, device_id) – **append-only; the source of truth for sync**. Card state can always be rebuilt by replaying logs through FSRS.
- `story` (id, level, series_id, body_json with tokens and lemma ids, audio_ref, word_timings)
- `error_record` (id, category, example, source: conversation or review, linked card)
- `study_session` (id, started_at, ended_at, minutes_active, activities)
- `settings`, `streak_state`

Card kinds: `cloze_production`, `sentence_production` (EN to IT, typed or spoken), `dictation`, `grammar_cloze`, `spoken_prompt` (Pimsleur), `recognition` (first exposure only), `minimal_pair` (HVPT, adaptive, not FSRS).

### Accounts and sync (Supabase; AI stays on-device)

Owen wants accounts and sync across devices (2026-11-15). Supabase provides Auth (Apple, Google, email) and Postgres with row-level security, used only for sync; no AI or audio goes to the server. The app stays fully usable offline and without signing in. Sync is local first: the device writes review logs and settings changes locally, pushes new rows, and pulls rows from other devices since a cursor. Review logs are immutable, so merging is a union and card state is rebuilt by replaying logs through FSRS. Settings use last-writer-wins per field. Shared DTOs live in `packages/api-contract` (zod). File export/import remains as a manual backup.

## 5. Key algorithms

- **Answer grading to FSRS rating**: normalise (case, punctuation, apostrophes), accept accent-insensitive matches but flag them, tolerate one typo per ~8 characters as Hard, wrong as Again, fast correct as Easy (latency threshold calibrated per card kind). Spoken answers: speech-to-text match decides correctness; pronunciation score is shown separately and never changes the rating.
- **Session builder**: due reviews first (interleaved by kind and grammar point), then new items up to the daily cap, throttled when projected load exceeds the user's time budget or recent accuracy drops under ~80%. Then one input block and one speaking block.
- **Known words and coverage**: a lemma is "known" when its card's retrievability is at least 0.9 and stability is at least 7 days (tunable). Story coverage = known tokens / content tokens, excluding proper nouns and cognates flagged in content.
- **Story selection and generation**: pick the bundled story with the best coverage in the 95 to 98% window that introduces 3 to 6 target lemmas. If none fits, the on-device LLM writes one using grammar-constrained decoding (GBNF) for lemma-tagged output; the app verifies coverage and grammar ceiling and retries before accepting.
- **CEFR estimate**: known-lemma count plus unlocked grammar points plus speaking scores, mapped to bands; shown as an estimate with a range.

## 5a. AI provider layer

AI features sit behind interfaces in `packages/core` (`StoryGenerator`, `ConversationPartner`, `Glosser`, `PronunciationScorer`, `SpeechToText`, `TextToSpeech`). Implementations are on-device (`llama.rn`, `whisper.rn`, sherpa-onnx, our scorer). Interfaces keep screens independent of the model, let us swap models as better small ones ship, and let tests use fakes.

## 6. Security and privacy

- No AI or audio leaves the phone; recordings are processed and deleted locally unless the user keeps them. Only learning records (review logs, cards, settings) sync to Supabase, protected by row-level security; no API keys in the app beyond the public Supabase anon key.
- Model downloads are pinned by SHA-256 in the manifest and verified before loading.
- Crash reporting is opt-in and strips learning content.
- Data export and delete-all built in.

## 7. Phased plan

Owen's v1 is everything below, including the tuned conversation model (2026-11-15). The phases order the work; v1 ships when all are done. Android is the primary test platform (Owen's phone); iOS is kept building in CI.

Each phase ends with a working app. Within a phase, workstreams run in parallel as separate agents and separate PRs.

**Phase 0: foundation (1 PR)**
Monorepo, Expo app shell with Expo Router and tab navigation, design tokens and base components, SQLite + Drizzle with first migration, ESLint, Prettier, Vitest, jest-expo, GitHub Actions CI, EAS config, docs and ADRs.

**Phase 1: offline learning core (4 parallel PRs)**
- A. `packages/core`: FSRS wrapper, grading, session builder, streaks, progress, known-word maths.
- B. `packages/content`: pipeline building the seed DB (first 2,000 lemmas, sentence pairs, grammar graph for A1 to A2), licence manifest.
- C. App screens: Today session runner, review card UIs for each kind, word detail, progress screen, settings.
- D. Local persistence layer: repositories over Drizzle, seed import, backup and restore.
Result: a usable flashcard and grammar app that works with no network, using device TTS.

**Phase 2: content pipeline at scale, audio, and sync (3 parallel PRs)**
- Supabase schema, RLS, auth (Apple, Google, email) and log-based sync.
- Build-time generation of glosses, sentences, grammar notes and graded story series for A1 to B1, with automatic coverage and grammar validation and a native-speaker review checklist.
- Bundled multi-voice audio with word timings; on-device TTS (Piper via sherpa-onnx) for anything generated at runtime.

**Phase 3: reader and listener (1 to 2 PRs)**
Synced transcript, tap-to-translate, add-to-reviews, playback speed, story selection by coverage.

**Phase 4: speaking (3 parallel PRs)**
- On-device speech to text (whisper.rn) and the Pimsleur-style prompt, pause, answer drills plus hands-free audio-only mode.
- On-device pronunciation scorer (packages/speech) validated against labelled recordings.
- HVPT ear training with multi-voice audio, and shadowing.

**Phase 5: on-device AI (2 to 3 PRs)**
- Model download manager and `llama.rn` runtime with device capability checks.
- Conversation scenarios with recasts and error records feeding reviews; runtime story generation.
- **Model programme (major effort, Owen's priority: aim for cloud-level tutoring quality on the phone)**: pick the strongest base that runs on target phones (benchmark several 3 to 8B candidates at 4-bit for Italian quality, speed and memory); build an evaluation suite first (Italian grammaticality judged by a large model plus native-speaker spot checks, level adherence, correct recasts and error tags, scenario completion, latency per token on real devices); distil from a large teacher model into a fine-tune (supervised fine-tune on tens of thousands of curated tutoring dialogues, then preference tuning), quantize with quality checks, and iterate until the eval gap to the cloud teacher is small. Fine-tune Whisper on Italian learner speech in the same way if transcription accuracy needs it.

**Phase 6: release hardening**
Onboarding and placement test, local reminders, accessibility pass, performance and battery profiling, Maestro end-to-end tests, (no store release or paywall: personal app, installed via EAS internal builds).

## 8. How the multi-agent build works

- I act as lead: I write the interfaces (types and zod schemas) for each phase first, so parallel agents code against a fixed contract.
- Each workstream agent works in its own git worktree and branch, writes tests first, and opens its own PR.
- A separate reviewer agent reviews every PR against this plan before I ask Owen to merge.
- Phases merge in order; within a phase, PRs are independent.

## 9. Open questions for Owen

Asked in the project chat and the build thread: audience and monetisation, current level, AI provider and budget, backend accounts and sync, v1 scope, test devices and Mac/EAS, branding, the initial commit to `main`, daily study time, voice data consent, accent or purpose, and word-list licensing.
