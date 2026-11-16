/**
 * The speech services the Speak screens use, behind provider interfaces:
 * speech to text, pronunciation scoring, the neural voice, the microphone,
 * sound output and microphone permission. The app provides the on-device
 * implementations; tests provide fakes (see `speech/testing.ts`).
 */
import { createContext, useContext, useState, type ReactNode } from 'react';
import { decodeAudioFileToFloatSamples } from 'react-native-sherpa-onnx/audio';

import type { SpeechToText, TextToSpeech } from '@italia/core';

import { useModelManager, uriToPath, type ModelManager } from '@/models';

import { createDeviceAudioOut, type AudioOut } from './audio/audioOut';
import { createStreamRecorder, type Recorder } from './audio/recorder';
import { MODEL_SAMPLE_RATE } from './pcm';
import { deviceMicPermissions, type MicPermissions } from './permissions';
import { loadOnnxPhonemizer, type Phonemizer } from './pronunciation/onnxPhonemizer';
import { createPronunciationScorer, type AppPronunciationScorer } from './pronunciation/scorer';
import { createAutoStt } from './stt/autoStt';
import { createOsStt } from './stt/osStt';
import { createSherpaStt, modelAvailability } from './stt/sherpaStt';
import { createSherpaTts } from './tts/sherpaTts';

/** Everything the speaking screens need. */
export interface SpeechServices {
  stt: SpeechToText;
  scorer: AppPronunciationScorer;
  /** The downloaded neural Italian voice (may need a download). */
  tts: TextToSpeech;
  recorder: Recorder;
  audio: AudioOut;
  mic: MicPermissions;
}

/** The on-device implementations. */
export function createNativeSpeechServices(models: ModelManager): SpeechServices {
  const streamRecorder = createStreamRecorder();
  let lastFileRate = MODEL_SAMPLE_RATE;
  const recorder: Recorder = {
    start: (onLevel) => streamRecorder.start(onLevel),
    async stop() {
      const recording = await streamRecorder.stop();
      lastFileRate = recording.fileSampleRateHz;
      return recording;
    },
    cancel: () => {
      streamRecorder.cancel();
    },
  };
  let phonemizer: { path: string; ready: Promise<Phonemizer> } | null = null;
  const scorer = createPronunciationScorer({
    availability: () => modelAvailability(models, 'phonemes'),
    phonemizer() {
      const installed = models.installedOfKind('phonemes');
      const file = installed?.spec.files[0];
      if (!installed || !file) throw new Error('Pronunciation scoring is not downloaded.');
      const path = uriToPath(`${installed.dir}/${file.name}`);
      if (phonemizer?.path !== path) phonemizer = { path, ready: loadOnnxPhonemizer(path) };
      return phonemizer.ready;
    },
    async decodeFile(uri) {
      const decoded = await decodeAudioFileToFloatSamples(uriToPath(uri), MODEL_SAMPLE_RATE);
      return Float32Array.from(decoded.samples);
    },
  });
  return {
    stt: createAutoStt(createSherpaStt(models), createOsStt({ sampleRateHz: () => lastFileRate })),
    scorer,
    tts: createSherpaTts(models),
    recorder,
    audio: createDeviceAudioOut(),
    mic: deviceMicPermissions,
  };
}

const SpeechContext = createContext<SpeechServices | null>(null);

/** Props for {@link SpeechProvider}. */
export interface SpeechProviderProps {
  children: ReactNode;
  /** Services to use instead of the native ones (tests). */
  services?: SpeechServices;
}

function NativeSpeechProvider({ children }: { children: ReactNode }) {
  const models = useModelManager();
  const [services] = useState(() => createNativeSpeechServices(models));
  return <SpeechContext.Provider value={services}>{children}</SpeechContext.Provider>;
}

/** Provides the speech services; render inside `ModelsProvider`. */
export function SpeechProvider({ children, services }: SpeechProviderProps) {
  if (services) return <SpeechContext.Provider value={services}>{children}</SpeechContext.Provider>;
  return <NativeSpeechProvider>{children}</NativeSpeechProvider>;
}

/** The speech services. */
export function useSpeech(): SpeechServices {
  const services = useContext(SpeechContext);
  if (!services) throw new Error('useSpeech must be used inside SpeechProvider');
  return services;
}
