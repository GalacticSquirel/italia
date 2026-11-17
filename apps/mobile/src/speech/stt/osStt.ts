/**
 * Speech to text with the phone's own recognizer (expo-speech-recognition),
 * on-device where the phone supports it. A zero-download fallback: it
 * transcribes the recorded WAV file (Android 13+ and iOS).
 */
import {
  AudioEncodingAndroid,
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionResult,
} from 'expo-speech-recognition';

import type {
  AudioClip,
  ProviderAvailability,
  SpeechToText,
  Transcript,
  TranscribeOptions,
} from '@italia/core';

/** A {@link SpeechToText} on the OS recognizer. Needs `file` clips (16-bit WAV). */
export function createOsStt(options: { sampleRateHz?: () => number } = {}): SpeechToText {
  return {
    id: 'os-recognizer',
    availability(): Promise<ProviderAvailability> {
      try {
        return Promise.resolve(
          ExpoSpeechRecognitionModule.isRecognitionAvailable() ? 'ready' : 'unsupported',
        );
      } catch {
        return Promise.resolve('unsupported');
      }
    },
    transcribe(audio: AudioClip, call?: TranscribeOptions): Promise<Transcript> {
      if (audio.kind !== 'file') {
        return Promise.reject(new Error('The phone recognizer needs a recorded file.'));
      }
      return new Promise<Transcript>((resolve, reject) => {
        let best: ExpoSpeechRecognitionResult | null = null;
        const subs = [
          ExpoSpeechRecognitionModule.addListener('result', (event) => {
            if (event.isFinal || best === null) best = event.results[0] ?? best;
          }),
          ExpoSpeechRecognitionModule.addListener('error', (event) => {
            cleanup();
            if (event.error === 'no-speech' || event.error === 'speech-timeout') {
              resolve({ text: '', segments: [] });
            } else reject(new Error(event.message));
          }),
          ExpoSpeechRecognitionModule.addListener('end', () => {
            cleanup();
            resolve(toTranscript(best));
          }),
        ];
        const onAbort = () => {
          ExpoSpeechRecognitionModule.abort();
        };
        function cleanup() {
          for (const s of subs) s.remove();
          call?.signal?.removeEventListener('abort', onAbort);
        }
        call?.signal?.addEventListener('abort', onAbort, { once: true });
        let onDevice = false;
        try {
          onDevice = ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
        } catch {
          onDevice = false;
        }
        ExpoSpeechRecognitionModule.start({
          lang: call?.language === undefined || call.language === 'it' ? 'it-IT' : call.language,
          interimResults: false,
          requiresOnDeviceRecognition: onDevice,
          addsPunctuation: false,
          contextualStrings: call?.hint?.split(/\s+/u).filter(Boolean) ?? [],
          audioSource: {
            uri: audio.uri,
            audioChannels: 1,
            audioEncoding: AudioEncodingAndroid.ENCODING_PCM_16BIT,
            sampleRate: options.sampleRateHz?.() ?? 16_000,
          },
        });
      });
    },
  };
}

function toTranscript(result: ExpoSpeechRecognitionResult | null): Transcript {
  if (!result) return { text: '', segments: [] };
  return {
    text: result.transcript.trim(),
    segments: result.segments.map((s) => ({
      text: s.segment,
      startMs: s.startTimeMillis,
      endMs: s.endTimeMillis,
    })),
    ...(result.confidence >= 0 ? { confidence: result.confidence } : {}),
  };
}
