# Speech on the device

How the Speak tab hears, scores and speaks, all on the phone (ADR 0004). Models are listed in
`models/manifest.json` and downloaded from Settings, On-device models; nothing is uploaded.

## Pieces

| Job            | Implementation (`apps/mobile/src/speech`)                                                                                                                                                                                | Without the model                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Microphone     | `audio/recorder.ts`: expo-audio PCM stream at 16 kHz mono float, plus a WAV copy (Android's MediaRecorder cannot write WAV)                                                                                              | Always available after permission                                           |
| Speech to text | `stt/sherpaStt.ts`: sherpa-onnx with the Parakeet TDT transducer                                                                                                                                                         | `stt/osStt.ts`: the phone's recognizer on the recorded file, on-device only |
| Pronunciation  | `pronunciation/`: the wav2vec2 Italian phonemizer through onnxruntime-react-native, greedy CTC decoding in TypeScript (`ctc.ts`), then `@italia/speech` (G2P, alignment, scores, checks); at most two tips, one per word | Feedback is hidden with a note to download the model                        |
| Italian voice  | `tts/sherpaTts.ts`: Piper `it_IT-paola-medium` through sherpa-onnx (its PCM also draws the shadowing waveform)                                                                                                           | The phone's Italian voice (expo-speech)                                     |
| English cues   | The phone's English voice                                                                                                                                                                                                |                                                                             |

Grading uses the transcript only (`gradeSpoken` in `@italia/core`); the pronunciation score is
shown separately and never changes a rating.

## Practice

- **Drill** (`features/speak/drill`): cue, pause, answer. A pure state machine (`drillMachine.ts`)
  and a hook that runs the side effects (`useDrillRunner.ts`). Recording stops when the learner
  stops speaking (`silence.ts`) or taps Done. One retry after a miss; the rating is the first
  attempt's. Spoken prompts also form one block at the end of the daily session.
- **Ear training** (`features/speak/hvpt`): two-alternative forced choice on `MINIMAL_PAIRS`,
  three levels (3 right in a row to go up, 2 misses in the last 4 to go down), weighted towards
  contrasts and pairs the learner misses, a different voice each trial. With device voices the
  open/close vowel pairs are left out; recorded speakers come from a Common Voice clip pack
  (`packages/content`, `build:clips`), which has not been built yet.
- **Shadowing**: model and learner waveforms, playback and the pronunciation score.
- **Hands-free**: keeps the screen awake and lets audio play in the background.

## Native build notes

- Android: sherpa-onnx and onnxruntime-react-native both ship ONNX Runtime. The config plugin
  `apps/mobile/plugins/withOnnxRuntimeCoexistence.js` pins one ONNX Runtime version and keeps
  the first copy of the duplicate native libraries.
- iOS: both libraries link ONNX Runtime too. Nothing is patched; check a release build on a
  device for duplicate-symbol warnings when either library is upgraded.
- Background audio is enabled with expo-audio's `enableBackgroundPlayback` plugin option in
  `app.json`.
- Needs a real device to verify: recording levels and end-of-speech timing, recognizer accuracy
  and speed, phonemizer timing, and the duplicate ONNX Runtime libraries.
