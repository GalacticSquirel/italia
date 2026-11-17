# audio

Pre-made Italian audio for the app: every word, every lesson sentence and every story sentence,
recorded at build time and downloaded by the phone as **audio packs** (manifest kind
`audio-pack`). Once a pack is downloaded the app plays its clips offline; anything without a clip
falls back to the on-device voice, then to the phone's own voice.

| Pack                 | What it holds                                                                 | Voice                                                               |
| -------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `audio-words`        | each of the seed's lemmas, said on its own                                    | native speakers from Lingua Libre where recorded, else Piper Serena |
| `audio-voice-sara`   | every seed sentence and story sentence (title, text, questions), word timings | Kokoro-82M `if_sara`                                                |
| `audio-voice-nicola` | the same, in a second voice                                                   | Kokoro-82M `im_nicola`                                              |

Two sentence voices let the app alternate speakers, so you hear Italian from more than one
person (high-variability input generalises better than one voice).

## Choosing the voices

We synthesised the same 60 items (30 seed sentences, 20 story sentences, 10 single words) with
every open Italian voice that runs on a CPU, transcribed each clip with Whisper large-v3-turbo,
and compared the transcript with the text (word error rate on sentences), plus a reference-free
quality estimate (torchaudio SQUIM, predicted PESQ):

| Voice                        | Sentence WER | Words heard right | Predicted PESQ | Real-time factor (4 CPU) |
| ---------------------------- | ------------ | ----------------- | -------------- | ------------------------ |
| Kokoro-82M `if_sara`         | **1.3%**     | 5/10              | 3.92           | 0.22                     |
| Kokoro-82M `im_nicola`       | 1.5%         | 4/10              | 3.69           | 0.22                     |
| Piper `it_IT-serena-medium`  | 1.8%         | **9/10**          | 4.00           | 0.03                     |
| Piper `it_IT-serena-high`    | 4.1%         | 8/10              | 4.08           | 0.15                     |
| Piper `it_IT-paola-medium`   | 6.4%         | 7/10              | 3.41           | 0.03                     |
| Piper `it_IT-riccardo-x_low` | 8.2%         | 5/10              | 3.70           | 0.02                     |

Kokoro is the clearest on sentences, but on isolated words it softens the first consonant
(_piccolo_ heard as "bicolo", _tono_ as "dono"), which would teach the wrong sound, so single
words use Serena, and real recordings first. Paola is the on-device voice the app already
downloads for generated text.

Native recordings: Tatoeba has audio for only 13 of our 14,000 sentences, so sentences are
synthetic. Lingua Libre (Wikimedia Commons, CC BY-SA / CC BY / CC0) has native-speaker
recordings for about two thirds of the 3,000 lemmas; we keep up to two speakers per word and
credit each one in the app.

## Pack format

Clips are keyed by the first 16 hex digits of the SHA-256 of the normalised text
(`italia_audio/textkey.py`; the app has the same function and both are tested against
`tests/clip-keys.json`). Keying by text, not row id, means new content (more stories, a larger
seed) only adds clips.

A pack is a list of append-only shards, `<pack>-sNNN.tar.zst`. Each unpacks to
`sNNN/index.json` and `sNNN/<k0k1>/<key>.m4a` (AAC-LC, mono, 24 kHz, 40 kb/s: about 5 KB a
second). A rebuild only records utterances that no published shard holds and adds them as the
next shard, so a phone with the pack downloads just the new shard. The index format is described
in `italia_audio/pack.py`; story clips carry word timings from forced alignment (torchaudio's
multilingual MMS aligner) for highlighting in the reader.

Every clip is trimmed, levelled to the same loudness and padded with 120 ms of silence.

## Building

The **Audio packs** workflow (Actions tab) runs everything: `plan` works out what is missing,
`record` runs up to 20 parallel jobs, and `publish` packs, uploads (with
`models/scripts/publish_files.py`) and commits the manifest. It needs the same `HF_TOKEN` secret
and `HF_MODELS_REPO` variable as **Publish model files**. Locally:

```sh
cd audio
uv sync --extra tts --extra publish
uv run python -m italia_audio plan --only audio-voice-sara --limit 20
uv run python -m italia_audio synth --pack audio-voice-sara --part 0 --parts 1
uv run python -m italia_audio assemble --pack audio-voice-sara
uv run pytest
```

Wikimedia rate-limits some cloud IP ranges; the workflow fetches recordings from GitHub's
runners, slowly and with a descriptive user agent, as Commons asks.
