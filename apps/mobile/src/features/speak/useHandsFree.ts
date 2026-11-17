import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';

import { useSpeech } from '@/speech';

const TAG = 'speak-hands-free';

/** Hands-free mode: keep the screen awake and let audio continue in the background. */
export function useHandsFree(enabled: boolean): void {
  const { audio } = useSpeech();
  useEffect(() => {
    if (!enabled) return;
    void activateKeepAwakeAsync(TAG).catch(() => undefined);
    void audio.setBackgroundPlayback(true).catch(() => undefined);
    return () => {
      void deactivateKeepAwake(TAG).catch(() => undefined);
      void audio.setBackgroundPlayback(false).catch(() => undefined);
    };
  }, [enabled, audio]);
}
