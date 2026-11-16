import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { Text } from './Text';
import { useTheme } from './ThemeProvider';
import { minTouchTarget } from './tokens';

export type ButtonVariant = 'primary' | 'secondary';
export type ButtonSize = 'regular' | 'compact';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  /** Visible label; also the accessibility label unless one is given. */
  label: string;
  /** Visual style. Defaults to `primary`. */
  variant?: ButtonVariant;
  /** `compact` for inline actions in dense layouts (same 48pt target, less padding). */
  size?: ButtonSize;
}

/** Accessible button with a 48pt minimum touch target. */
export function Button({
  label,
  variant = 'primary',
  size = 'regular',
  disabled = false,
  accessibilityLabel,
  ...rest
}: ButtonProps) {
  const { colors, radii, spacing } = useTheme();
  const isPrimary = variant === 'primary';
  const compact = size === 'compact';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={4}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        {
          borderRadius: compact ? radii.pill : radii.md,
          paddingHorizontal: compact ? spacing.md : spacing.xl,
          paddingVertical: compact ? 0 : spacing.md,
          backgroundColor: isPrimary
            ? pressed
              ? colors.primaryPressed
              : colors.primary
            : 'transparent',
          borderColor: isPrimary ? 'transparent' : colors.primary,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text variant="label" color={isPrimary ? 'onPrimary' : 'primary'}>
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
