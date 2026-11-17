import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';

import { useSpeech, type MicStatus } from '@/speech';
import { Button, EmptyState, useTheme } from '@/ui';

/** Why the app asks for the microphone, shown before the system prompt. */
export const MIC_RATIONALE =
  'Speaking practice needs the microphone so the app can hear your Italian. Your voice is processed on this phone and never uploaded.';

export interface MicGateProps {
  children: ReactNode;
  /** Shown under the permission card, for example a way to carry on without speaking. */
  fallback?: ReactNode;
}

/**
 * Shows `children` once the microphone is allowed; before that, explains why
 * it is needed and asks, or points to the system settings when blocked.
 */
export function MicGate({ children, fallback }: MicGateProps) {
  const { mic } = useSpeech();
  const { colors, spacing } = useTheme();
  const [status, setStatus] = useState<MicStatus | null>(null);

  useEffect(() => {
    let live = true;
    void mic.get().then((s) => {
      if (live) setStatus(s);
    });
    return () => {
      live = false;
    };
  }, [mic]);

  const ask = useCallback(() => {
    void mic.request().then(setStatus);
  }, [mic]);

  if (status === null) {
    return (
      <ActivityIndicator color={colors.primary} accessibilityLabel="Checking the microphone" />
    );
  }
  if (status === 'granted') return children;
  let card: ReactNode;
  if (status === 'blocked') {
    card = (
      <EmptyState
        title="Microphone is off"
        message={`${MIC_RATIONALE} Turn on the microphone for Italia in your phone's settings.`}
        action={
          <Button
            label="Open settings"
            onPress={() => {
              void Linking.openSettings();
            }}
          />
        }
      />
    );
  } else {
    card = (
      <EmptyState
        title="Allow the microphone"
        message={MIC_RATIONALE}
        action={<Button label="Allow microphone" onPress={ask} />}
      />
    );
  }
  return (
    <View style={{ gap: spacing.md }}>
      {card}
      {fallback}
    </View>
  );
}
