import { View } from 'react-native';

import { Chip } from './Chip';
import { useTheme } from './ThemeProvider';

export interface SegmentedControlProps<T extends string> {
  /** What is being chosen, read by screen readers. */
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** One choice from a few options, exposed to screen readers as a radio group. */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const { spacing } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}
    >
      {options.map((o) => (
        <Chip
          key={o.value}
          role="radio"
          label={o.label}
          selected={o.value === value}
          onPress={() => {
            onChange(o.value);
          }}
        />
      ))}
    </View>
  );
}
