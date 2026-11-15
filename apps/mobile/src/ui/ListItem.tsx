import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { useTheme } from './ThemeProvider';
import { minTouchTarget } from './tokens';

export interface ListItemProps {
  title: string;
  subtitle?: string;
  /** Short text at the trailing edge (for example a due date). */
  detail?: string;
  onPress?: () => void;
  /** Screen reader label; defaults to title, subtitle and detail. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  trailing?: ReactNode;
}

/** A tappable row in a list. */
export function ListItem({
  title,
  subtitle,
  detail,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  trailing,
}: ListItemProps) {
  const { colors, spacing } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={
        accessibilityLabel ?? [title, subtitle, detail].filter(Boolean).join(', ')
      }
      accessibilityHint={accessibilityHint}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          gap: spacing.md,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderBottomColor: colors.border,
          backgroundColor: pressed ? colors.track : 'transparent',
        },
      ]}
    >
      <View style={styles.main}>
        <Text variant="bodyStrong">{title}</Text>
        {subtitle ? (
          <Text variant="caption" color="textMuted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {detail ? (
        <Text variant="caption" color="textMuted">
          {detail}
        </Text>
      ) : null}
      {trailing}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  main: { flex: 1, gap: 2 },
});
