import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Text } from './Text';
import { useTheme } from './ThemeProvider';
import { maxFontSizeMultiplier, minTouchTarget } from './tokens';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  /** Visible label above the field; also its accessibility label unless one is given. */
  label: string;
  /** Hide the visible label (it is still read by screen readers). */
  hideLabel?: boolean;
}

/** Themed single-line text input with a label and a 48pt minimum height. */
export function TextField({
  label,
  hideLabel = false,
  accessibilityLabel,
  ...rest
}: TextFieldProps) {
  const { colors, radii, spacing, typography } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      {hideLabel ? null : (
        <Text variant="label" color="textMuted" importantForAccessibility="no">
          {label}
        </Text>
      )}
      <TextInput
        accessibilityLabel={accessibilityLabel ?? label}
        placeholderTextColor={colors.textMuted}
        maxFontSizeMultiplier={maxFontSizeMultiplier}
        selectionColor={colors.primary}
        {...rest}
        style={[
          styles.input,
          typography.body,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radii.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: minTouchTarget, borderWidth: 1.5 },
});
