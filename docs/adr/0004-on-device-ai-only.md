# ADR 0004: All AI runs on the device

- Status: Accepted
- Date: 2026-11-15

## Context

The app needs an LLM (conversation, story generation, glosses, error explanations), speech to
text, text to speech and pronunciation scoring. Cloud APIs would be stronger but cost money per
use, need keys behind a server, fail offline and send the learner's voice off the phone.

## Decision

- **No cloud AI at runtime.** Every model runs on the phone:
  - LLM: llama.cpp via `llama.rn` with a small quantised instruction model (later our own
    fine-tune).
  - Speech to text: whisper.cpp via `whisper.rn`, with the OS on-device recogniser as fallback.
  - Text to speech: bundled neural audio for fixed content, Piper voices via sherpa-onnx for
    generated text, OS voices as fallback.
  - Pronunciation: our own scorer (Italian G2P, phoneme CTC model via ONNX Runtime, alignment and
    goodness-of-pronunciation scores).
- AI features sit behind interfaces in `packages/core` (`StoryGenerator`, `ConversationPartner`,
  `Glosser`, `PronunciationScorer`, `SpeechToText`, `TextToSpeech`) so screens do not depend on a
  model and tests use fakes.
- Model weights are **downloaded after install**, listed in `models/manifest.json` with URL, size,
  SHA-256 and licence, and verified before loading. Weights are never committed to git.
- Large models and cloud TTS may be used at **build time** by the content pipeline; nothing from
  that path ships as a runtime dependency.
- Supabase (ADR 0002) is used for accounts and sync only; it never calls a model.

## Consequences

- No per-use cost or API keys, and everything works in airplane mode.
- Conversation and story writing need roughly 6 GB of RAM; older phones get every other feature.
- Quality is lower than cloud models; mitigated by constrained prompts, rule checks on
  corrections, and the Phase 5 model programme.
- Native modules mean a development build is required; Expo Go cannot run the app.
- About 2 to 3 GB of storage for all models.
