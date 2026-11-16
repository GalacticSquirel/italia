import { useEffect } from 'react';

import { sayItalian, useSpeech } from '@/speech';
import { Button } from '@/ui';

export interface ListenButtonProps {
  text: string;
  rate: number;
  label?: string;
  /** Speak once when shown. */
  autoPlay?: boolean;
  variant?: 'primary' | 'secondary';
}

/**
 * Plays Italian text: with the downloaded Italian voice when it is installed,
 * else with the device voice.
 */
export function ListenButton({
  text,
  rate,
  label = 'Listen',
  autoPlay = false,
  variant = 'secondary',
}: ListenButtonProps) {
  const speech = useSpeech();
  useEffect(() => {
    if (autoPlay) void sayItalian(speech, text, rate);
    return () => {
      speech.audio.stop();
    };
  }, [speech, autoPlay, text, rate]);
  return (
    <Button
      label={label}
      variant={variant}
      accessibilityHint="Plays the Italian audio"
      onPress={() => {
        speech.audio.stop();
        void sayItalian(speech, text, rate);
      }}
    />
  );
}
