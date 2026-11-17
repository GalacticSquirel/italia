/**
 * On-device neural Italian voice (Piper paola via sherpa-onnx, see
 * `models/manifest.json`). Returns PCM, so screens can draw its waveform.
 */
import { createTTS, type TtsEngine } from 'react-native-sherpa-onnx/tts';

import type {
  CallOptions,
  ProviderAvailability,
  SpeechRequest,
  SynthesisedSpeech,
  TextToSpeech,
  Voice,
} from '@italia/core';

import type { ModelManager } from '@/models';
import { uriToPath } from '@/models';

import { modelAvailability } from '../stt/sherpaStt';

const VOICE: Voice = { id: 'piper-it-paola', language: 'it-IT', name: 'Paola' };

function throwIfAborted(options?: CallOptions): void {
  if (options?.signal?.aborted === true) {
    const reason: unknown = options.signal.reason;
    throw reason instanceof Error ? reason : new Error('Aborted');
  }
}

/** A {@link TextToSpeech} on the downloaded voice. */
export function createSherpaTts(models: ModelManager): TextToSpeech {
  let engine: { dir: string; tts: Promise<TtsEngine> } | null = null;
  const engineFor = (dir: string) => {
    if (engine?.dir !== dir) {
      engine = {
        dir,
        tts: createTTS({ modelPath: { type: 'file', path: uriToPath(dir) }, modelType: 'vits' }),
      };
    }
    return engine.tts;
  };
  return {
    id: 'sherpa-onnx-piper',
    availability(): Promise<ProviderAvailability> {
      return Promise.resolve(modelAvailability(models, 'tts'));
    },
    voices(options?: CallOptions) {
      throwIfAborted(options);
      return Promise.resolve(models.installedOfKind('tts') ? [VOICE] : []);
    },
    async synthesise(request: SpeechRequest, options?: CallOptions): Promise<SynthesisedSpeech> {
      throwIfAborted(options);
      const installed = models.installedOfKind('tts');
      if (!installed) throw new Error('The Italian voice is not downloaded.');
      const tts = await engineFor(installed.dir);
      const audio = await tts.generateSpeech(request.text, { speed: request.rate ?? 1 });
      throwIfAborted(options);
      return {
        audio: {
          kind: 'pcm',
          samples: Float32Array.from(audio.samples),
          sampleRateHz: audio.sampleRate,
        },
        wordTimings: [],
      };
    },
  };
}
