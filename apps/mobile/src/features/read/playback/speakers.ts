/**
 * Speakers for story playback: the downloaded neural Italian voice when it
 * is installed (on-device synthesis, with the audio length known, so word
 * timings can be estimated precisely), else the device's own Italian voice,
 * which reports each word as it speaks it where the platform supports that.
 */
import type { SpeechServices } from '@/speech';
import { ITALIAN } from '@/speech';

import type { PlaybackSentence, PreparedSpeech, SentenceSpeaker } from './playbackController';
import {
  engineTimings,
  estimateDeviceDurationMs,
  estimateTimings,
  type WordTimings,
} from './timings';

/** Resolves once `signal` aborts (immediately if it already has). */
function aborted(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    signal.addEventListener(
      'abort',
      () => {
        resolve();
      },
      { once: true },
    );
  });
}

/** Reads the signal afresh (a plain property check is narrowed away across awaits). */
const isAborted = (signal: AbortSignal): boolean => signal.aborted;

function abortError(): Error {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

/** Play with the device voice, stopping it when `signal` aborts. */
function deviceSpeech(
  services: Pick<SpeechServices, 'audio'>,
  sentence: PlaybackSentence,
  rate: number,
): PreparedSpeech {
  return {
    voice: 'device',
    timings: estimateTimings(
      sentence.text,
      sentence.tokens,
      estimateDeviceDurationMs(sentence.text, rate),
    ),
    timing: 'estimated',
    async play(signal, onBoundary) {
      if (signal.aborted) return;
      const stop = () => {
        services.audio.stop();
      };
      signal.addEventListener('abort', stop, { once: true });
      try {
        await Promise.race([
          services.audio.speak(sentence.text, {
            language: ITALIAN,
            rate,
            onBoundary: (event) => {
              onBoundary(event.charIndex);
            },
          }),
          aborted(signal),
        ]);
      } finally {
        signal.removeEventListener('abort', stop);
      }
    },
  };
}

/**
 * A {@link SentenceSpeaker} over the app's speech services: the neural voice
 * when ready (falling back to the device voice if synthesis fails), else the
 * device voice.
 */
export function createStorySpeaker(
  services: Pick<SpeechServices, 'tts' | 'audio'>,
): SentenceSpeaker {
  return {
    async prepare(sentence, rate, signal) {
      if (signal.aborted) throw abortError();
      if ((await services.tts.availability()) === 'ready') {
        try {
          const speech = await services.tts.synthesise({ text: sentence.text, rate }, { signal });
          const { audio } = speech;
          const durationMs =
            audio.kind === 'pcm' && audio.sampleRateHz > 0
              ? (audio.samples.length / audio.sampleRateHz) * 1000
              : estimateDeviceDurationMs(sentence.text, rate);
          const fromEngine = engineTimings(speech.wordTimings, sentence.tokens);
          const timings: WordTimings =
            fromEngine ?? estimateTimings(sentence.text, sentence.tokens, durationMs);
          return {
            voice: 'neural',
            timings,
            timing: fromEngine ? 'engine' : 'estimated',
            async play(playSignal) {
              if (playSignal.aborted) return;
              const stop = () => {
                services.audio.stop();
              };
              playSignal.addEventListener('abort', stop, { once: true });
              try {
                await Promise.race([services.audio.play(audio), aborted(playSignal)]);
              } finally {
                playSignal.removeEventListener('abort', stop);
              }
            },
          };
        } catch {
          if (isAborted(signal)) throw abortError();
          // Synthesis failed: fall through to the device voice.
        }
      }
      return deviceSpeech(services, sentence, rate);
    },
  };
}
