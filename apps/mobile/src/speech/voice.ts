import type { AudioClip } from '@italia/core';

import type { Clip, ClipQuery } from '@/audio/clipLibrary';

import type { SpeechServices } from './SpeechContext';

/** Language of English cues. */
export const ENGLISH = 'en-GB';
/** Language of Italian speech. */
export const ITALIAN = 'it-IT';

/** Options for {@link sayItalian}. */
export interface SayOptions extends ClipQuery {
  /** Called with the pre-recorded clip about to play (for crediting native speakers). */
  onClip?: (clip: Clip) => void;
}

/**
 * Say Italian text, best source first: a pre-recorded clip from a downloaded
 * audio pack, else the downloaded neural voice (returning its audio, for
 * waveforms), else the device voice. Returns the audio played, or null for
 * the device voice.
 */
export async function sayItalian(
  services: Pick<SpeechServices, 'tts' | 'audio' | 'clips'>,
  text: string,
  rate = 1,
  options: SayOptions = {},
): Promise<AudioClip | null> {
  const recorded = await services.clips.lookup(text, options).catch(() => null);
  if (recorded) {
    const clip: AudioClip = { kind: 'file', uri: recorded.uri };
    try {
      options.onClip?.(recorded);
      await services.audio.play(clip, { rate });
      return clip;
    } catch {
      // Fall through to synthesis.
    }
  }
  if ((await services.tts.availability()) === 'ready') {
    try {
      const speech = await services.tts.synthesise({ text, rate });
      await services.audio.play(speech.audio);
      return speech.audio;
    } catch {
      // Fall through to the device voice.
    }
  }
  await services.audio.speak(text, { language: ITALIAN, rate });
  return null;
}

/** Say several Italian texts one after another (a word, then its example). */
export async function sayItalianParts(
  services: Pick<SpeechServices, 'tts' | 'audio' | 'clips'>,
  parts: readonly string[],
  rate = 1,
  options: { isCancelled?: () => boolean; onClip?: (clip: Clip) => void } = {},
): Promise<void> {
  for (const part of parts) {
    if (options.isCancelled?.() === true) return;
    await sayItalian(services, part, rate, options.onClip ? { onClip: options.onClip } : {});
  }
}

/** Say an English cue with the device voice. */
export function sayEnglish(
  services: Pick<SpeechServices, 'audio'>,
  text: string,
  rate = 1,
): Promise<void> {
  return services.audio.speak(text, { language: ENGLISH, rate });
}
