/**
 * Microphone capture for speaking practice: 16 kHz mono float PCM from
 * expo-audio's audio stream, written alongside to a WAV file (for playback
 * and for the OS recognizer).
 */
import { AudioModule, setAudioModeAsync, type AudioStreamBuffer } from 'expo-audio';

import type { AudioClip } from '@italia/core';

import { concatFloat32, durationMs, MODEL_SAMPLE_RATE, resampleLinear, rms, toMono } from '../pcm';

/** A finished recording. */
export interface Recording {
  /** Mono samples at {@link MODEL_SAMPLE_RATE}. */
  samples: Float32Array;
  sampleRateHz: number;
  /** WAV file of the recording (at the hardware rate), if one was written. */
  uri: string | null;
  /** Sample rate of the WAV file. */
  fileSampleRateHz: number;
  durationMs: number;
}

/** The recording as a clip: its WAV file when there is one, else the samples. */
export function recordingClip(recording: Recording): AudioClip {
  return recording.uri === null
    ? { kind: 'pcm', samples: recording.samples, sampleRateHz: recording.sampleRateHz }
    : { kind: 'file', uri: recording.uri };
}

/** Records one utterance at a time. */
export interface Recorder {
  /** Start recording; `onLevel` receives the input level (0 to 1) as audio arrives. */
  start(onLevel?: (level: number) => void): Promise<void>;
  /** Stop and return the recording. */
  stop(): Promise<Recording>;
  /** Stop and discard. */
  cancel(): void;
}

/** A {@link Recorder} on expo-audio's native PCM stream. */
export function createStreamRecorder(): Recorder {
  let stream: InstanceType<typeof AudioModule.AudioStream> | null = null;
  let subscription: { remove(): void } | null = null;
  let chunks: Float32Array[] = [];
  let rate = MODEL_SAMPLE_RATE;
  let channels = 1;

  const release = () => {
    subscription?.remove();
    subscription = null;
    try {
      stream?.stop();
    } catch {
      // Already stopped.
    }
    stream = null;
  };

  return {
    async start(onLevel) {
      release();
      chunks = [];
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      const s = new AudioModule.AudioStream({
        sampleRate: MODEL_SAMPLE_RATE,
        channels: 1,
        encoding: 'float32',
      });
      stream = s;
      subscription = s.addListener('audioStreamBuffer', (buffer: AudioStreamBuffer) => {
        rate = buffer.sampleRate;
        channels = buffer.channels;
        const chunk = new Float32Array(buffer.data);
        chunks.push(chunk);
        onLevel?.(Math.min(1, rms(chunk) * 4));
      });
      await s.start();
      await s.startFileRecordingAsync({ format: 'wav', directory: 'cache' });
    },
    async stop() {
      const s = stream;
      if (!s) throw new Error('Not recording');
      const file = await s.stopFileRecordingAsync();
      release();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const mono = toMono(concatFloat32(chunks), channels);
      const samples = resampleLinear(mono, rate, MODEL_SAMPLE_RATE);
      chunks = [];
      return {
        samples,
        sampleRateHz: MODEL_SAMPLE_RATE,
        uri: file.uri,
        fileSampleRateHz: file.sampleRate,
        durationMs: durationMs(samples.length, MODEL_SAMPLE_RATE),
      };
    },
    cancel() {
      release();
      chunks = [];
    },
  };
}
