import { View } from 'react-native';

import { useTheme } from './ThemeProvider';

export interface ProgressBarProps {
  /** Progress from 0 to 1; values outside are clamped. */
  value: number;
  /** What is being measured, read by screen readers (for example "Today's reviews"). */
  label: string;
  testID?: string;
}

/** Horizontal progress bar exposed to assistive tech as a progress bar with a percentage. */
export function ProgressBar({ value, label, testID }: ProgressBarProps) {
  const { colors, radii } = useTheme();
  const clamped = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const percent = Math.round(clamped * 100);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: percent, text: `${String(percent)}%` }}
      testID={testID}
      style={{
        height: 8,
        borderRadius: radii.pill,
        backgroundColor: colors.track,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${String(percent)}%`,
          height: '100%',
          borderRadius: radii.pill,
          backgroundColor: colors.primary,
        }}
      />
    </View>
  );
}
