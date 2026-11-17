/**
 * Test-only fakes of the speech services. Never import from app code.
 */
import type { AudioClip, ProviderAvailability } from '@italia/core';
import {
  createFakePronunciationScorer,
  createFakeSpeechToText,
  createFakeTextToSpeech,
} from '@italia/core/testing';

import type { Clip } from '@/audio/clipLibrary';
import { createFakeClipLibrary } from '@/audio/testing';

import type { AudioOut, SpeakOptions } from './audio/audioOut';
import type { Recorder, Recording } from './audio/recorder';
import type { MicStatus } from './permissions';
import { analysePronunciation } from './pronunciation/analyse';
import type { AppPronunciationScorer } from './pronunciation/scorer';
import type { SpeechServices } from './SpeechContext';

/** A fake recorder returning one second of quiet noise. */
export function createFakeRecorder(): Recorder & { starts: number } {
  const fake = {
    starts: 0,
    recording: false,
    start(onLevel?: (level: number) => void) {
      fake.starts += 1;
      fake.recording = true;
      onLevel?.(0.5);
      return Promise.resolve();
    },
    stop(): Promise<Recording> {
      fake.recording = false;
      const samples = Float32Array.from({ length: 16_000 }, (_, i) => Math.sin(i / 10) * 0.1);
      return Promise.resolve({
        samples,
        sampleRateHz: 16_000,
        uri: 'file:///cache/answer.wav',
        fileSampleRateHz: 16_000,
        durationMs: 1000,
      });
    },
    cancel() {
      fake.recording = false;
    },
  };
  return fake;
}

/** A fake {@link AudioOut} that records what was said and played. */
export function createFakeAudioOut(voices = 2): AudioOut & {
  spoken: { text: string; options: SpeakOptions }[];
  played: number;
  playedClips: { clip: AudioClip; rate: number }[];
  background: boolean;
} {
  const fake = {
    spoken: [] as { text: string; options: SpeakOptions }[],
    played: 0,
    playedClips: [] as { clip: AudioClip; rate: number }[],
    background: false,
    speak(text: string, options: SpeakOptions) {
      fake.spoken.push({ text, options });
      return Promise.resolve();
    },
    play(clip: AudioClip, options?: { rate?: number }) {
      fake.played += 1;
      fake.playedClips.push({ clip, rate: options?.rate ?? 1 });
      return Promise.resolve();
    },
    voices(language: string) {
      return Promise.resolve(
        Array.from({ length: voices }, (_, i) => ({
          id: `voice-${String(i)}`,
          language: `${language}-IT`,
          name: `Voice ${String(i)}`,
        })),
      );
    },
    stop() {
      // Nothing is playing.
    },
    setBackgroundPlayback(enabled: boolean) {
      fake.background = enabled;
      return Promise.resolve();
    },
  };
  return fake;
}

/** Options for {@link createFakeSpeechServices}. */
export interface FakeSpeechOptions {
  transcripts?: readonly string[];
  sttAvailability?: ProviderAvailability;
  scorerAvailability?: ProviderAvailability;
  ttsAvailability?: ProviderAvailability;
  overall?: number;
  mic?: MicStatus;
  /** Status after the learner answers the permission prompt. */
  micAfterRequest?: MicStatus;
  /** Pre-recorded clips by text (none by default). */
  clips?: Record<string, Partial<Clip>>;
}

/** Fake speech services built on the `@italia/core/testing` provider fakes. */
export function createFakeSpeechServices(options: FakeSpeechOptions = {}) {
  const stt = createFakeSpeechToText({
    transcripts: options.transcripts ?? [],
    availability: options.sttAvailability ?? 'ready',
  });
  const base = createFakePronunciationScorer({
    overall: options.overall ?? 0.8,
    availability: options.scorerAvailability ?? 'ready',
  });
  const scorer: AppPronunciationScorer = {
    ...base,
    async analyse(request, call) {
      const score = await base.score(request, call);
      return { ...analysePronunciation(request.expectedText, []), score };
    },
  };
  let mic: MicStatus = options.mic ?? 'granted';
  const services = {
    stt,
    scorer,
    tts: createFakeTextToSpeech({ availability: options.ttsAvailability ?? 'needs_download' }),
    recorder: createFakeRecorder(),
    audio: createFakeAudioOut(),
    clips: createFakeClipLibrary(options.clips),
    mic: {
      get: () => Promise.resolve(mic),
      request: () => {
        mic = options.micAfterRequest ?? 'granted';
        return Promise.resolve(mic);
      },
    },
  } satisfies SpeechServices;
  return services;
}
