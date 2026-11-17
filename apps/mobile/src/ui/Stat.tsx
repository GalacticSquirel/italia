import { View } from 'react-native';

import { Text } from './Text';
import { useTheme } from './ThemeProvider';

export interface StatProps {
  label: string;
  value: string;
  /** Optional small print under the value. */
  caption?: string;
}

/** A labelled number, read by screen readers as one phrase. */
export function Stat({ label, value, caption }: StatProps) {
  const { spacing } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={[`${label}: ${value}`, caption].filter(Boolean).join('. ')}
      style={{ flexGrow: 1, flexBasis: 120, gap: spacing.xxs }}
    >
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      <Text variant="title" accessibilityRole="text">
        {value}
      </Text>
      {caption ? (
        <Text variant="caption" color="textMuted">
          {caption}
        </Text>
      ) : null}
    </View>
  );
}
