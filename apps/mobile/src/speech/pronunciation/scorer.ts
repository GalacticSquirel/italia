/**
 * The app's {@link PronunciationScorer}: phones from a {@link Phonemizer},
 * then {@link analysePronunciation}. Guidance only; it never changes a rating.
 */
import type {
  AudioClip,
  CallOptions,
  PronunciationRequest,
  PronunciationScore,
  PronunciationScorer,
  ProviderAvailability,
} from '@italia/core';

import { MODEL_SAMPLE_RATE, resampleLinear } from '../pcm';
import { analysePronunciation, type PronunciationAnalysis } from './analyse';
import type { Phonemizer } from './onnxPhonemizer';

/** Dependencies of {@link createPronunciationScorer}. */
export interface ScorerDeps {
  availability(): ProviderAvailability;
  /** Load (or reuse) the phonemizer. */
  phonemizer(): Promise<Phonemizer>;
  /** Decode a recorded file to 16 kHz mono samples. */
  decodeFile(uri: string): Promise<Float32Array>;
}

function throwIfAborted(options?: CallOptions): void {
  if (options?.signal?.aborted === true) {
    const reason: unknown = options.signal.reason;
    throw reason instanceof Error ? reason : new Error('Aborted');
  }
}

async function samplesOf(audio: AudioClip, deps: ScorerDeps): Promise<Float32Array> {
  if (audio.kind === 'file') return deps.decodeFile(audio.uri);
  return resampleLinear(audio.samples, audio.sampleRateHz, MODEL_SAMPLE_RATE);
}

/** A scorer that also exposes the full analysis of its last call. */
export interface AppPronunciationScorer extends PronunciationScorer {
  analyse(request: PronunciationRequest, options?: CallOptions): Promise<PronunciationAnalysis>;
}

/** Create the scorer. */
export function createPronunciationScorer(deps: ScorerDeps): AppPronunciationScorer {
  const analyse = async (
    request: PronunciationRequest,
    options?: CallOptions,
  ): Promise<PronunciationAnalysis> => {
    throwIfAborted(options);
    const [phonemizer, samples] = await Promise.all([
      deps.phonemizer(),
      samplesOf(request.audio, deps),
    ]);
    throwIfAborted(options);
    const phones = await phonemizer.recognize(samples);
    throwIfAborted(options);
    return analysePronunciation(request.expectedText, phones, {
      samples,
      sampleRateHz: MODEL_SAMPLE_RATE,
    });
  };
  return {
    id: 'wav2vec2-phonemizer-gop',
    availability: () => Promise.resolve(deps.availability()),
    analyse,
    async score(request, options): Promise<PronunciationScore> {
      return (await analyse(request, options)).score;
    },
  };
}
