/**
 * Runs the downloaded phoneme recognizer (ONNX) with onnxruntime-react-native
 * and decodes its output with the pure CTC decoder. This is the only ML
 * runtime code in pronunciation scoring.
 */
import { InferenceSession, Tensor } from 'onnxruntime-react-native';

import type { RecognizedPhone } from '@italia/speech';

import { ctcGreedyDecode } from './ctc';
import { PHONEMIZER_CTC } from './phonemizer';

/** Recognises phones in 16 kHz mono audio. */
export interface Phonemizer {
  recognize(samples: Float32Array): Promise<RecognizedPhone[]>;
  release(): Promise<void>;
}

/** Load the phonemizer from an ONNX file path. */
export async function loadOnnxPhonemizer(modelPath: string): Promise<Phonemizer> {
  const session = await InferenceSession.create(modelPath, {
    executionProviders: ['cpu'],
    graphOptimizationLevel: 'all',
  });
  return {
    async recognize(samples) {
      if (samples.length < 400) return []; // shorter than one model frame
      const audio = new Tensor('float32', samples, [1, samples.length]);
      const output = await session.run({ audio });
      const logits = output.logits;
      if (!logits) throw new Error('The phoneme model returned no output.');
      return ctcGreedyDecode(logits.data as Float32Array, PHONEMIZER_CTC);
    },
    release: () => session.release(),
  };
}
