import { View } from 'react-native';

import { envelope } from '@/speech';
import { Text, useTheme, type ColorTokens } from '@/ui';

export interface WaveformProps {
  samples: Float32Array | null;
  label: string;
  color?: keyof ColorTokens;
  /** Bars drawn. Default 48. */
  bars?: number;
}

const HEIGHT = 56;

/** A simple amplitude envelope drawn with views. */
export function Waveform({ samples, label, color = 'primary', bars = 48 }: WaveformProps) {
  const { colors, radii, spacing } = useTheme();
  const levels = samples ? envelope(samples, bars) : [];
  const peak = Math.max(1e-6, ...levels);
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={samples ? `${label} waveform` : `${label}: no audio yet`}
        style={{
          height: HEIGHT,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          borderRadius: radii.sm,
          backgroundColor: colors.track,
          paddingHorizontal: spacing.xs,
        }}
      >
        {levels.map((v, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: Math.max(2, (v / peak) * (HEIGHT - 8)),
              borderRadius: 1,
              backgroundColor: colors[color],
            }}
          />
        ))}
      </View>
    </View>
  );
}
