import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import type { ClipCredit } from '@/audio/clipLibrary';
import { sayItalianParts, useSpeech } from '@/speech';
import { Button, Text, useTheme } from '@/ui';

export interface ListenButtonProps {
  /** Italian to say: one text, or several said one after another (a word, then its example). */
  text: string | readonly string[];
  rate: number;
  label?: string;
  /** Speak once when shown (and again if the text changes). */
  autoPlay?: boolean;
  variant?: 'primary' | 'secondary';
}

/** How a native speaker's recording is credited (their licences ask for attribution). */
export function creditLine(credit: ClipCredit): string {
  return `Said by ${credit.by} · Lingua Libre${credit.licence ? `, ${credit.licence}` : ''}`;
}

/**
 * Plays Italian with the best audio available (see `sayItalian`), crediting
 * the speaker when a native speaker's recording plays.
 */
export function ListenButton({
  text,
  rate,
  label = 'Listen',
  autoPlay = false,
  variant = 'secondary',
}: ListenButtonProps) {
  const services = useSpeech();
  const key = typeof text === 'string' ? text : text.join('\n');
  const { spacing } = useTheme();
  const cancel = useRef<(() => void) | null>(null);
  const [credit, setCredit] = useState<ClipCredit | null>(null);

  const play = useCallback(() => {
    cancel.current?.();
    let cancelled = false;
    cancel.current = () => {
      cancelled = true;
      services.audio.stop();
    };
    services.audio.stop();
    void sayItalianParts(services, key.split('\n'), rate, {
      isCancelled: () => cancelled,
      onClip: (clip) => {
        if (!cancelled && clip.credit) setCredit(clip.credit);
      },
    }).catch(() => undefined);
  }, [services, key, rate]);

  useEffect(() => {
    if (autoPlay) play();
  }, [autoPlay, play]);
  useEffect(
    () => () => {
      cancel.current?.();
    },
    [],
  );

  return (
    <View style={{ gap: spacing.xxs }}>
      <Button
        label={label}
        variant={variant}
        accessibilityHint="Plays the Italian audio"
        onPress={play}
      />
      {credit ? (
        <Text variant="caption" color="textMuted">
          {creditLine(credit)}
        </Text>
      ) : null}
    </View>
  );
}
