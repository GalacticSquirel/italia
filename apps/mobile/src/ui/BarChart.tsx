import { View } from 'react-native';

import { Text } from './Text';
import { useTheme } from './ThemeProvider';

export interface BarDatum {
  /** Short label under the bar (for example "Mon"). */
  label: string;
  value: number;
  /** Full description read by screen readers (for example "Monday, 12 reviews"). */
  accessibilityLabel: string;
}

export interface BarChartProps {
  /** What the chart shows, read by screen readers before the bars. */
  title: string;
  data: readonly BarDatum[];
  /** Height of the tallest bar in points. Defaults to 120. */
  height?: number;
}

/** Simple vertical bars drawn with views; each bar is read by screen readers. */
export function BarChart({ title, data, height = 120 }: BarChartProps) {
  const { colors, radii, spacing } = useTheme();
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View accessibilityLabel={title} style={{ gap: spacing.xs }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: spacing.sm,
          height: height + 24,
        }}
      >
        {data.map((d) => (
          <View
            key={d.label}
            accessible
            accessibilityLabel={d.accessibilityLabel}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: spacing.xxs }}
          >
            <Text variant="caption" color="textMuted">
              {String(d.value)}
            </Text>
            <View
              style={{
                width: '100%',
                height: Math.max(2, (d.value / max) * height),
                borderRadius: radii.sm,
                backgroundColor: d.value > 0 ? colors.primary : colors.track,
              }}
            />
          </View>
        ))}
      </View>
      <View
        style={{ flexDirection: 'row', gap: spacing.sm }}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {data.map((d) => (
          <Text
            key={d.label}
            variant="caption"
            color="textMuted"
            style={{ flex: 1, textAlign: 'center' }}
          >
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
