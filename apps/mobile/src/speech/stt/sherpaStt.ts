/**
 * Speech to text with the downloaded transducer model (Parakeet TDT, see
 * `models/manifest.json`) through react-native-sherpa-onnx. Fully offline.
 */
import { createSTT, type SttEngine } from 'react-native-sherpa-onnx/stt';

import type {
  AudioClip,
  ProviderAvailability,
  SpeechToText,
  Transcript,
  TranscribeOptions,
} from '@italia/core';

import type { ModelManager } from '@/models';
import { uriToPath } from '@/models';

import { MODEL_SAMPLE_RATE, resampleLinear } from '../pcm';
import { wordsFromTokens } from './tokens';

function throwIfAborted(options?: TranscribeOptions): void {
  if (options?.signal?.aborted === true) {
    const reason: unknown = options.signal.reason;
    throw reason instanceof Error ? reason : new Error('Aborted');
  }
}

/** Availability of a model kind from the model manager. */
export function modelAvailability(models: ModelManager, kind: 'stt' | 'phonemes' | 'tts') {
  if (models.installedOfKind(kind)) return 'ready' as const;
  const views = models.getSnapshot().filter((m) => m.spec.kind === kind);
  return views.some((v) => v.status !== 'unavailable' && v.status !== 'unsupported')
    ? ('needs_download' as const)
    : ('unsupported' as const);
}

/** A {@link SpeechToText} on the downloaded sherpa-onnx model. */
export function createSherpaStt(models: ModelManager): SpeechToText & { release(): Promise<void> } {
  let engine: { dir: string; stt: Promise<SttEngine> } | null = null;

  const engineFor = (dir: string): Promise<SttEngine> => {
    if (engine?.dir !== dir) {
      const previous = engine;
      engine = {
        dir,
        stt: createSTT({
          modelPath: { type: 'file', path: uriToPath(dir) },
          modelType: 'nemo_transducer',
          preferInt8: true,
          numThreads: 2,
        }),
      };
      void previous?.stt.then((e) => e.destroy()).catch(() => undefined);
    }
    return engine.stt;
  };

  return {
    id: 'sherpa-onnx-parakeet',
    availability(): Promise<ProviderAvailability> {
      return Promise.resolve(modelAvailability(models, 'stt'));
    },
    async transcribe(audio: AudioClip, options?: TranscribeOptions): Promise<Transcript> {
      throwIfAborted(options);
      const installed = models.installedOfKind('stt');
      if (!installed) throw new Error('Speech recognition is not downloaded.');
      const stt = await engineFor(installed.dir);
      throwIfAborted(options);
      const result =
        audio.kind === 'file'
          ? await stt.transcribeFile(uriToPath(audio.uri))
          : await stt.transcribeSamples(
              Array.from(resampleLinear(audio.samples, audio.sampleRateHz, MODEL_SAMPLE_RATE)),
              MODEL_SAMPLE_RATE,
            );
      throwIfAborted(options);
      return {
        text: result.text.trim(),
        segments: wordsFromTokens(result.tokens, result.timestamps, result.durations),
      };
    },
    async release() {
      const current = engine;
      engine = null;
      if (current) await (await current.stt).destroy();
    },
  };
}
