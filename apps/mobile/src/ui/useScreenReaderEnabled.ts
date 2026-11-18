import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Whether a screen reader (TalkBack, VoiceOver) is on, kept up to date. */
export function useScreenReaderEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((on) => {
      if (active) setEnabled(on);
    });
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setEnabled);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);
  return enabled;
}
