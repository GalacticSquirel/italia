import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { useTheme } from './ThemeProvider';
import { minTouchTarget } from './tokens';

export interface StepperProps {
  label: string;
  /** Optional explanation under the label. */
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Formats the value for display and screen readers. */
  format?: (value: number) => string;
  onChange: (value: number) => void;
}

/** Rounds away floating-point noise from repeated steps such as 0.01. */
const round = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * A number setting with minus and plus buttons. Screen readers see one
 * adjustable control (swipe up or down to change it).
 */
export function Stepper({
  label,
  hint,
  value,
  min,
  max,
  step,
  format = String,
  onChange,
}: StepperProps) {
  const { colors, radii, spacing } = useTheme();
  const change = (delta: number) => {
    const next = round(Math.min(max, Math.max(min, value + delta)));
    if (next !== value) onChange(next);
  };
  const text = format(value);
  const button = (symbol: string, delta: number, disabled: boolean) => (
    <Pressable
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      disabled={disabled}
      onPress={() => {
        change(delta);
      }}
      testID={`${label}-${delta > 0 ? 'increase' : 'decrease'}`}
      style={({ pressed }) => [
        styles.button,
        {
          borderRadius: radii.md,
          borderColor: colors.primary,
          backgroundColor: pressed ? colors.track : 'transparent',
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <Text variant="heading" color="primary" accessibilityRole="text">
        {symbol}
      </Text>
    </Pressable>
  );
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityValue={{ min, max, now: value, text }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        change(e.nativeEvent.actionName === 'increment' ? step : -step);
      }}
      style={{ gap: spacing.xs }}
    >
      <Text variant="bodyStrong">{label}</Text>
      {hint ? (
        <Text variant="caption" color="textMuted">
          {hint}
        </Text>
      ) : null}
      <View style={[styles.row, { gap: spacing.md }]}>
        {button('−', -step, value <= min)}
        <Text variant="heading" accessibilityRole="text" style={styles.value}>
          {text}
        </Text>
        {button('+', step, value >= max)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  value: { minWidth: 72, textAlign: 'center' },
  button: {
    minWidth: minTouchTarget,
    minHeight: minTouchTarget,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
