import { Pressable, StyleSheet } from 'react-native';

import { minTouchTarget, Text, useTheme } from '@/ui';

/** Props for {@link ReaderAction}. */
export interface ReaderActionProps {
  label: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  onPress: () => void;
  /** Shown as switched on. */
  selected?: boolean;
  disabled?: boolean;
}

/** A compact text button for the reader (48pt target, smaller padding than `Button`). */
export function ReaderAction({
  label,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  selected = false,
  disabled = false,
}: ReaderActionProps) {
  const { colors, radii, spacing } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          borderRadius: radii.pill,
          paddingHorizontal: spacing.md,
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primary : pressed ? colors.track : colors.surface,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text variant="label" color={selected ? 'onPrimary' : 'primary'}>
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
    borderWidth: 1,
  },
});
