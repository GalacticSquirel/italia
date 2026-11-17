import { View } from 'react-native';

import type { GrammarPointRow } from '@/data';
import { Button, Card, Markdown, Text, useTheme } from '@/ui';

export interface GrammarIntroCardProps {
  point: GrammarPointRow;
  onContinue: () => void;
}

/** A short explicit note shown before the first practice of a new grammar point. */
export function GrammarIntroCard({ point, onContinue }: GrammarIntroCardProps) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.lg }}>
      <Card>
        <Text variant="caption" color="textMuted">
          New grammar
        </Text>
        <Text variant="title">{point.title}</Text>
        <Markdown source={point.noteMd} />
      </Card>
      <Button label="Start practising" onPress={onContinue} />
    </View>
  );
}
