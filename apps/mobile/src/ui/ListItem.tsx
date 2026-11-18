import { Children, Fragment, isValidElement, type ReactNode } from 'react';
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
  /** Replaces the chevron a tappable row shows at its trailing edge. */
  trailing?: ReactNode;
}

/**
 * A row in a list. Rows line up with the content around them (a card's
 * padding, or the screen's), and their pressed highlight bleeds into that
 * padding. A tappable row shows a chevron unless it has its own `trailing`
 * content. Put rows in a {@link List} to separate them.
 */
export function ListItem({
  title,
  subtitle,
  detail,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  trailing,
}: ListItemProps) {
  const { colors, spacing, radii } = useTheme();
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
          paddingVertical: spacing.md,
          marginHorizontal: -spacing.sm,
          paddingHorizontal: spacing.sm,
          borderRadius: radii.sm,
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
      {trailing ??
        (onPress ? (
          <Text
            variant="heading"
            color="textMuted"
            importantForAccessibility="no"
            accessibilityElementsHidden
          >
            ›
          </Text>
        ) : null)}
    </Pressable>
  );
}

/** Rows separated by hairlines (none above the first or below the last). */
export function List({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View>
      {rows.map((row, i) => (
        <Fragment key={row.key ?? i}>
          {i > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
  },
  main: { flex: 1, gap: 2 },
  divider: { height: StyleSheet.hairlineWidth },
});
