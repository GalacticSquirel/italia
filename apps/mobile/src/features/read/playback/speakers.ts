/**
 * Speakers for story playback, best first: a recording from a downloaded
 * audio pack (with word timings from forced alignment), else the downloaded
 * neural Italian voice (on-device synthesis, with the audio length known, so
 * word timings can be estimated precisely), else the device's own Italian
 * voice, which reports each word as it speaks it where the platform supports
 * that.
 */
import { normaliseSpoken, sha256Hex } from '@/audio/clipKey';
import type { Clip } from '@/audio/clipLibrary';
import type { SpeechServices } from '@/speech';
import { ITALIAN } from '@/speech';

import type { PlaybackSentence, PreparedSpeech, SentenceSpeaker } from './playbackController';
import {
  engineTimings,
  estimateDeviceDurationMs,
  estimateTimings,
  recordedTimings,
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

/** Play a clip, stopping it when `signal` aborts. */
async function playUntilAborted(
  services: Pick<SpeechServices, 'audio'>,
  play: () => Promise<void>,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) return;
  const stop = () => {
    services.audio.stop();
  };
  signal.addEventListener('abort', stop, { once: true });
  try {
    await Promise.race([play(), aborted(signal)]);
  } finally {
    signal.removeEventListener('abort', stop);
  }
}

/** A recorded clip as prepared speech; timings scale with the playback rate. */
function recordedSpeech(
  services: Pick<SpeechServices, 'audio'>,
  sentence: PlaybackSentence,
  clip: Clip,
  rate: number,
): PreparedSpeech {
  const durationMs = clip.durationMs / rate;
  const aligned =
    clip.timings && normaliseSpoken(sentence.text) === sentence.text
      ? recordedTimings(clip.timings, sentence.tokens, clip.durationMs)
      : null;
  return {
    voice: 'recorded',
    voiceName: clip.voice.name,
    timings: aligned
      ? aligned.map(([start, end]) => [start / rate, end / rate] as const)
      : estimateTimings(sentence.text, sentence.tokens, durationMs),
    timing: aligned ? 'engine' : 'estimated',
    play: (signal) =>
      playUntilAborted(
        services,
        () => services.audio.play({ kind: 'file', uri: clip.uri }, { rate }),
        signal,
      ),
  };
}

/** Options for {@link createStorySpeaker}. */
export interface StorySpeakerOptions {
  /**
   * Picks one of the downloaded voices for the whole story (stories with
   * different seeds get different readers), so one voice reads it through.
   */
  voiceSeed?: string;
}

/**
 * A {@link SentenceSpeaker} over the app's speech services: a recording when
 * a downloaded pack has the sentence, else the neural voice when ready
 * (falling back to the device voice if synthesis fails), else the device
 * voice.
 */
export function createStorySpeaker(
  services: Pick<SpeechServices, 'tts' | 'audio' | 'clips'>,
  options: StorySpeakerOptions = {},
): SentenceSpeaker {
  let reader: Promise<string | undefined> | null = null;
  const packId = () => {
    reader ??= services.clips
      .voices()
      .then((voices) => {
        if (voices.length === 0 || options.voiceSeed === undefined) return undefined;
        const pick = parseInt(sha256Hex(options.voiceSeed).slice(0, 6), 16) % voices.length;
        return voices[pick]?.packId;
      })
      .catch(() => undefined);
    return reader;
  };
  return {
    async prepare(sentence, rate, signal) {
      if (signal.aborted) throw abortError();
      const pack = await packId();
      const clip = await services.clips
        .lookup(sentence.text, pack === undefined ? {} : { packId: pack })
        .catch(() => null);
      if (isAborted(signal)) throw abortError();
      if (clip) return recordedSpeech(services, sentence, clip, rate);
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
            play: (playSignal) =>
              playUntilAborted(services, () => services.audio.play(audio), playSignal),
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
