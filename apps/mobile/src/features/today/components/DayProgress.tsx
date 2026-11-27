import { View } from 'react-native';

import type { DailyStep } from '@italia/core';

import { useTheme } from '@/ui';

export interface DayProgressProps {
  steps: readonly DailyStep[];
}

/** One segment per path step: filled when finished, tinted for the step to do now. */
export function DayProgress({ steps }: DayProgressProps) {
  const { colors, spacing, radii } = useTheme();
  const finished = steps.filter((s) => s.status === 'done' || s.status === 'skipped').length;
  const total = steps.length;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Today's path: ${String(finished)} of ${String(total)} steps done`}
      accessibilityValue={{ min: 0, max: total, now: finished }}
      style={{ flexDirection: 'row', gap: spacing.xs }}
      testID="day-progress"
    >
      {steps.map((s) => (
        <View
          key={s.id}
          style={{
            flex: 1,
            height: spacing.sm,
            borderRadius: radii.pill,
            backgroundColor:
              s.status === 'done' || s.status === 'skipped'
                ? colors.primary
                : s.status === 'current'
                  ? colors.primarySurface
                  : colors.track,
            borderWidth: s.status === 'current' ? 1 : 0,
            borderColor: colors.primary,
          }}
        />
      ))}
    </View>
  );
}
