import { Pressable, StyleSheet } from 'react-native';

import { Text } from './Text';
import { useTheme } from './ThemeProvider';
import { minTouchTarget } from './tokens';

export interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Screen reader label; defaults to `label`. */
  accessibilityLabel?: string;
  /** Role announced to screen readers. Defaults to `button`. */
  role?: 'button' | 'radio' | 'tab';
}

/** A compact toggle used for filters and segmented choices. */
export function Chip({ label, selected, onPress, accessibilityLabel, role = 'button' }: ChipProps) {
  const { colors, radii, spacing } = useTheme();
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={role === 'radio' ? { checked: selected } : { selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          borderRadius: radii.pill,
          paddingHorizontal: spacing.lg,
          backgroundColor: selected ? colors.primary : pressed ? colors.track : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <Text variant="label" color={selected ? 'onPrimary' : 'text'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTouchTarget,
    minWidth: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
});
