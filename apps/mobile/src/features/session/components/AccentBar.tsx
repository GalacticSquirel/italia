import { Pressable, StyleSheet, View } from 'react-native';

import { minTouchTarget, Text, useTheme } from '@/ui';

/** Accented letters Italian uses, in the order learners need them most. */
export const ACCENTS = ['à', 'è', 'é', 'ì', 'ò', 'ù'] as const;

const NAMES: Record<(typeof ACCENTS)[number], string> = {
  à: 'a grave',
  è: 'e grave',
  é: 'e acute',
  ì: 'i grave',
  ò: 'o grave',
  ù: 'u grave',
};

export interface AccentBarProps {
  onInsert: (char: string) => void;
  disabled?: boolean;
}

/** A row of buttons that type accented vowels, for keyboards without them. */
export function AccentBar({ onInsert, disabled = false }: AccentBarProps) {
  const { colors, radii, spacing } = useTheme();
  return (
    <View accessibilityLabel="Accented letters" style={[styles.row, { gap: spacing.xs }]}>
      {ACCENTS.map((char) => (
        <Pressable
          key={char}
          accessibilityRole="button"
          accessibilityLabel={`Type ${NAMES[char]}`}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={() => {
            onInsert(char);
          }}
          style={({ pressed }) => [
            styles.key,
            {
              borderRadius: radii.sm,
              borderColor: colors.border,
              backgroundColor: pressed ? colors.track : colors.surface,
            },
          ]}
        >
          <Text variant="heading">{char}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  key: {
    minWidth: minTouchTarget,
    minHeight: minTouchTarget,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
