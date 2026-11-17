import type { ProviderAvailability, SpeechToText } from '@italia/core';

/**
 * Speech to text that uses `primary` (the downloaded model) when it is ready
 * and `fallback` (the phone's recognizer) otherwise. Availability is `ready`
 * if either can run now; else `needs_download` when the primary could be
 * downloaded.
 */
export function createAutoStt(
  primary: SpeechToText,
  fallback: SpeechToText,
): SpeechToText & {
  /** Which provider would transcribe now. */
  active(): Promise<SpeechToText | null>;
} {
  const active = async (): Promise<SpeechToText | null> => {
    if ((await primary.availability()) === 'ready') return primary;
    if ((await fallback.availability()) === 'ready') return fallback;
    return null;
  };
  return {
    id: `auto(${primary.id},${fallback.id})`,
    active,
    async availability(): Promise<ProviderAvailability> {
      const p = await primary.availability();
      if (p === 'ready') return 'ready';
      if ((await fallback.availability()) === 'ready') return 'ready';
      return p;
    },
    async transcribe(audio, options) {
      const provider = await active();
      if (!provider) throw new Error('No speech recognition is available on this phone.');
      return provider.transcribe(audio, options);
    },
  };
}
