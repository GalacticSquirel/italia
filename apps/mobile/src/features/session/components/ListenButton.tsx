import { useEffect } from 'react';

import { speakItalian, stopSpeaking } from '@/platform/speech';
import { Button } from '@/ui';

export interface ListenButtonProps {
  text: string;
  rate: number;
  label?: string;
  /** Speak once when shown. */
  autoPlay?: boolean;
  variant?: 'primary' | 'secondary';
}

/** Plays Italian text with the device voice. */
export function ListenButton({
  text,
  rate,
  label = 'Listen',
  autoPlay = false,
  variant = 'secondary',
}: ListenButtonProps) {
  useEffect(() => {
    if (autoPlay) speakItalian(text, rate);
    return stopSpeaking;
  }, [autoPlay, text, rate]);
  return (
    <Button
      label={label}
      variant={variant}
      accessibilityHint="Plays the Italian audio"
      onPress={() => {
        speakItalian(text, rate);
      }}
    />
  );
}
