# models

On-device AI models (LLM, speech to text, text to speech, pronunciation scoring) are downloaded
by the app after install, on Wi-Fi, resumably, and verified by SHA-256 before they are used.
**No weights are committed to git.** The app's model manager (`apps/mobile/src/models`) reads
`manifest.json`; its format is defined by `manifest.schema.json` (JSON Schema, version 2).

## Format

A model is one or more files downloaded into one install folder named after the model `id`:

| Field         | Meaning                                                                               |
| ------------- | ------------------------------------------------------------------------------------- |
| `id`          | Stable identifier and install folder name, lowercase                                  |
| `kind`        | `stt`, `phonemes`, `tts`, `llm`, `audio-pack` or `engine`; providers pick by kind     |
| `title`       | Short name shown in Settings > On-device models                                       |
| `description` | One sentence shown under the title                                                    |
| `licence`     | SPDX expression covering the weights and data files                                   |
| `source`      | Upstream model page                                                                   |
| `minRamBytes` | Least total device RAM to offer the model (see the device tiers in the app)           |
| `rootDir`     | For archives: the folder inside the install folder that holds the model               |
| `files[]`     | `name`, `url`, `sha256`, `sizeBytes`, `verification`, optional `extract`, `available` |

`verification` records where each checksum came from:

- `downloaded`: we downloaded the file and hashed it ourselves.
- `published`: copied from the host's published metadata (for example Hugging Face LFS) for a
  file too large to fetch when it was added.
- `built`: we produce the file with a reproducible script in `models/scripts/`; `available: false`
  means it is not uploaded yet, so the app does not offer it.

## Where the files live

Every file is mirrored to one public Hugging Face model repository that we own (free storage
and bandwidth, no file size limit, resumable downloads), with URLs pinned to a commit.
`scripts/publish_files.py` uploads each file (from a local build or its upstream URL, checked
against the manifest's size and SHA-256), skips files already there, and rewrites the URLs. Run
it from GitHub with the **Publish model files** workflow (Actions tab), which needs the
`HF_TOKEN` (or `HF_WRITE`) secret (a Hugging Face write token) and the `HF_MODELS_REPO` variable
(`OWNER/italia-models`). Put files we build (the phonemizer export, a fine-tuned tutor GGUF) in
`models/build/` (git-ignored) or pass `--local-dir`.

## Engine builds (`kind: engine`)

llama.rn ships one ~12 MB copy of llama.cpp per Arm feature level. The APK keeps only the
generic copy; the faster CPU-specific copies are manifest entries with `provides: "llama"` and
`cpu: { abi, features }`, listed most specific first. A model with `needsEngine: "llama"` (every
`llm`) is downloaded together with the first engine entry the phone's CPU supports (read from
`/proc/cpuinfo`, the same way llama.rn's loader does), and shown as one item. The patched loader
(`patches/llama.rn@*.patch`) loads a downloaded build from `models/llama-engine-<variant>/` once
the app has verified it (the `.installed` marker); otherwise it falls back to the generic copy.
The `withSlimNativeLibs` config plugin leaves a build out of the APK only once its manifest
entry is published, so nothing is lost before the upload, and stores native libraries
compressed. The Hexagon/OpenCL build is dropped once engines are published: the app cannot tell
which phones have that NPU, and the CPU builds run Q4_0 models well.

## Audio packs (`kind: audio-pack`)

Pre-recorded clips for words, sentences and stories, built and published by the **Audio packs**
workflow (see `audio/README.md`). Each file is one append-only shard (`<id>-sNNN.tar.zst`,
`extract: "tar.zst"`); when content grows the workflow adds a shard, and a phone that has the
pack downloads only that file. Each shard's `index.json` is also uploaded beside the archive so
the next build knows which clips exist.

## Current models

| Model                            | Files                                                                        | Size     | Checksum                                        |
| -------------------------------- | ---------------------------------------------------------------------------- | -------- | ----------------------------------------------- |
| Parakeet TDT 0.6B v3 int8 (STT)  | sherpa-onnx encoder, decoder, joiner, tokens (Hugging Face, pinned revision) | 670.6 MB | downloaded and verified                         |
| wav2vec2 Italian phonemizer int8 | one ONNX file, exported by `scripts/export_phonemizer.py`                    | 122.0 MB | built (byte-reproducible); **not uploaded yet** |
| Piper it_IT paola medium (TTS)   | sherpa-onnx `tar.bz2` archive (model, tokens, espeak-ng data)                | 67.2 MB  | downloaded and verified                         |
| Gemma 4 E4B instruct Q4_0 (LLM)  | one GGUF (ggml-org, pinned revision); phones with 11 GiB of RAM or more      | 4.59 GB  | published (Hugging Face LFS)                    |
| Gemma 4 E2B instruct Q4_0 (LLM)  | one GGUF (ggml-org, pinned revision); phones with 7 GiB of RAM or more       | 2.84 GB  | published (Hugging Face LFS)                    |

The phonemizer has no published ONNX export. `scripts/export_phonemizer.py` exports the pinned
checkpoint with normalisation built into the graph and int8 weights; with the pinned package
versions it reproduces the manifest's SHA-256 exactly. Upload the result as a release asset at
the manifest URL, then set `available` to `true`.

The conversation partner is the base Gemma 4 instruct model for now. The app offers the first
`llm` entry the phone's memory allows, so the fine-tuned tutor GGUF (`training/export`) replaces a
base model by taking its manifest entry. The two GGUF checksums and sizes are the Hugging Face LFS
metadata at the pinned revision; we checked each file's header (GGUF v3, `gemma4`, Q4_0, chat
template included) but did not download and hash the whole file, and neither has been run on a
phone with the pinned `llama.rn` release yet.

Licences: Gemma 4 weights are Apache-2.0. Parakeet weights are CC BY 4.0 (attribution in the app's credits). The Piper voice is
MIT (Piper) with a CC0 training dataset; its archive includes espeak-ng data files (GPL-3.0),
which are downloaded data, not linked code. Only add a model whose licence permits use in the
app.
