/**
 * Sound output for speaking practice: device text to speech (expo-speech) for
 * English cues and as the Italian fallback, and playback of recordings and
 * synthesised PCM (expo-audio).
 */
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import * as Speech from 'expo-speech';

import type { AudioClip, Voice } from '@italia/core';

import { encodeWav } from '../pcm';
import { speechLanguage } from './speechLanguage';

/** Options for {@link AudioOut.speak}. */
export interface SpeakOptions {
  /** BCP 47 language, for example `en-GB` or `it-IT`. */
  language: string;
  /** Speech rate, 1 = normal. */
  rate?: number;
  /** Device voice id. */
  voiceId?: string;
  /** Called as each word starts, where the platform reports it (character offsets into `text`). */
  onBoundary?: (event: { charIndex: number; charLength: number }) => void;
}

/** Sound output used by the speaking screens (faked in tests). */
export interface AudioOut {
  /** Speak with a device voice; resolves when done or stopped. */
  speak(text: string, options: SpeakOptions): Promise<void>;
  /** Play a clip (at `rate`, pitch kept); resolves when it ends or is stopped. */
  play(clip: AudioClip, options?: { rate?: number }): Promise<void>;
  /** Device voices for a language prefix such as `it`. */
  voices(language: string): Promise<Voice[]>;
  /** Stop speech and playback. */
  stop(): void;
  /**
   * Keep audio playing with the screen locked (hands-free mode). Whether the
   * OS allows it depends on the platform and the app's background modes.
   */
  setBackgroundPlayback(enabled: boolean): Promise<void>;
}

let clipCounter = 0;

/** The device implementation of {@link AudioOut}. */
export function createDeviceAudioOut(): AudioOut {
  let stopCurrent: (() => void) | null = null;

  const play = async (clip: AudioClip, rate = 1): Promise<void> => {
    let uri: string;
    if (clip.kind === 'file') uri = clip.uri;
    else {
      clipCounter += 1;
      const file = new File(Paths.cache, `speech-${String(clipCounter)}.wav`);
      await file.write(encodeWav(clip.samples, clip.sampleRateHz));
      uri = file.uri;
    }
    const player = createAudioPlayer(uri);
    if (rate !== 1) {
      player.shouldCorrectPitch = true;
      player.setPlaybackRate(rate, 'high');
    }
    await new Promise<void>((resolve) => {
      const finish = () => {
        sub.remove();
        player.remove();
        if (stopCurrent === finish) stopCurrent = null;
        resolve();
      };
      const sub = player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) finish();
      });
      stopCurrent = () => {
        player.pause();
        finish();
      };
      player.play();
    });
  };

  return {
    speak(text, { language, rate = 1, voiceId, onBoundary }) {
      stopCurrent?.();
      return new Promise<void>((resolve) => {
        const done = () => {
          resolve();
        };
        void Speech.stop();
        Speech.speak(text, {
          language: speechLanguage(language),
          rate,
          ...(voiceId === undefined ? {} : { voice: voiceId }),
          ...(onBoundary === undefined ? {} : { onBoundary }),
          onDone: done,
          onStopped: done,
          onError: done,
        });
      });
    },
    play(clip, options) {
      stopCurrent?.();
      return play(clip, options?.rate);
    },
    async voices(language) {
      const all = await Speech.getAvailableVoicesAsync();
      return all
        .filter((v) => v.language.toLowerCase().startsWith(language.toLowerCase()))
        .map((v) => ({ id: v.identifier, language: v.language, name: v.name }));
    },
    stop() {
      void Speech.stop();
      stopCurrent?.();
    },
    setBackgroundPlayback(enabled) {
      return setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: enabled,
        interruptionMode: enabled ? 'doNotMix' : 'mixWithOthers',
      });
    },
  };
}
