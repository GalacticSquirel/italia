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
| `kind`        | `stt`, `phonemes`, `tts`, `llm` or `audio-pack`; the app picks providers by kind      |
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

## Current models

| Model                            | Files                                                                        | Size     | Checksum                                        |
| -------------------------------- | ---------------------------------------------------------------------------- | -------- | ----------------------------------------------- |
| Parakeet TDT 0.6B v3 int8 (STT)  | sherpa-onnx encoder, decoder, joiner, tokens (Hugging Face, pinned revision) | 670.6 MB | downloaded and verified                         |
| wav2vec2 Italian phonemizer int8 | one ONNX file, exported by `scripts/export_phonemizer.py`                    | 122.0 MB | built (byte-reproducible); **not uploaded yet** |
| Piper it_IT paola medium (TTS)   | sherpa-onnx `tar.bz2` archive (model, tokens, espeak-ng data)                | 67.2 MB  | downloaded and verified                         |

The phonemizer has no published ONNX export. `scripts/export_phonemizer.py` exports the pinned
checkpoint with normalisation built into the graph and int8 weights; with the pinned package
versions it reproduces the manifest's SHA-256 exactly. Upload the result as a release asset at
the manifest URL, then set `available` to `true`.

Licences: Parakeet weights are CC BY 4.0 (attribution in the app's credits). The Piper voice is
MIT (Piper) with a CC0 training dataset; its archive includes espeak-ng data files (GPL-3.0),
which are downloaded data, not linked code. Only add a model whose licence permits use in the
app.
