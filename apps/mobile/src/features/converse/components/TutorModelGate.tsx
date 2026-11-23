import type { ReactNode } from 'react';
import { View } from 'react-native';

import { formatBytes } from '@/features/models/format';
import { ModelCard } from '@/features/models/ModelsScreen';
import { useTutorModel } from '@/tutor';
import { Card, Text, useTheme } from '@/ui';

const GIB = 1024 ** 3;

/**
 * Shows `children` once a conversation model is installed. Otherwise it says
 * honestly why conversations are not available and, when the phone can run a
 * model, offers the download (with its size) through the model manager.
 */
export function TutorModelGate({ children }: { children: ReactNode }) {
  const choice = useTutorModel();
  const { spacing } = useTheme();
  switch (choice.state) {
    case 'ready':
      return <>{children}</>;
    case 'needs_download':
      return (
        <View style={{ gap: spacing.md }} testID="tutor-needs-download">
          <Text variant="heading">Download the conversation partner</Text>
          <Text color="textMuted">
            {`Conversations run entirely on this phone, so the tutor model has to be downloaded once (${formatBytes(choice.model.bytesTotal)}). Use Wi-Fi if you can. Everything else in the app works without it.`}
          </Text>
          <ModelCard model={choice.model} />
          <Text variant="caption" color="textMuted">
            The tutor is a small model and can make mistakes. Its corrections are checked before you
            see them, and it is never a replacement for a teacher.
          </Text>
        </View>
      );
    case 'unsupported':
      return (
        <Card testID="tutor-unsupported" accessibilityRole="summary">
          <Text variant="heading">Conversations need more memory</Text>
          <Text color="textMuted">
            {`The conversation partner runs on the phone and needs at least ${String(
              (choice.minRamBytes ?? 8 * GIB) / GIB,
            )} GB of memory, and this phone has less. Speaking drills, shadowing, ear training, reading and reviews all still work.`}
          </Text>
        </Card>
      );
    case 'unavailable':
      return (
        <Card testID="tutor-unavailable" accessibilityRole="summary">
          <Text variant="heading">Not available yet</Text>
          <Text color="textMuted">
            The conversation model has not been published yet. Speaking drills and shadowing work in
            the meantime.
          </Text>
        </Card>
      );
  }
}
