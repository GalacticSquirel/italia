import * as Speech from 'expo-speech';

/** Language of all spoken prompts. */
export const ITALIAN = 'it-IT';

/**
 * Speak Italian text with the device's on-device voice, stopping anything
 * already being spoken. `rate` is the learner's speech-rate setting.
 */
export function speakItalian(text: string, rate: number, onDone?: () => void): void {
  void Speech.stop();
  Speech.speak(text, { language: ITALIAN, rate, onDone, onStopped: onDone, onError: onDone });
}

/** Stop speaking. */
export function stopSpeaking(): void {
  void Speech.stop();
}
