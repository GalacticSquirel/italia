import type { AudioClip } from '@italia/core';

import type { SpeechServices } from './SpeechContext';

/** Language of English cues. */
export const ENGLISH = 'en-GB';
/** Language of Italian speech. */
export const ITALIAN = 'it-IT';

/**
 * Say Italian text: with the downloaded neural voice when it is installed
 * (returning its audio, for waveforms), else with the device voice (null).
 */
export async function sayItalian(
  services: Pick<SpeechServices, 'tts' | 'audio'>,
  text: string,
  rate = 1,
): Promise<AudioClip | null> {
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

/** Say an English cue with the device voice. */
export function sayEnglish(
  services: Pick<SpeechServices, 'audio'>,
  text: string,
  rate = 1,
): Promise<void> {
  return services.audio.speak(text, { language: ENGLISH, rate });
}
