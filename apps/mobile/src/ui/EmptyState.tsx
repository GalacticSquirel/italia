import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Card } from './Card';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';

export interface EmptyStateProps {
  title: string;
  message: string;
  /** Optional action, usually a Button. */
  action?: ReactNode;
}

/** Placeholder shown when a screen has nothing to show yet. */
export function EmptyState({ title, message, action }: EmptyStateProps) {
  const { spacing } = useTheme();
  return (
    <Card accessible={!action} accessibilityLabel={action ? undefined : `${title}. ${message}`}>
      <Text variant="heading">{title}</Text>
      <Text color="textMuted">{message}</Text>
      {action ? <View style={{ marginTop: spacing.sm }}>{action}</View> : null}
    </Card>
  );
}
