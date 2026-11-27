import { View } from 'react-native';

import { Button, Text, useTheme } from '@/ui';

import type { StepView } from '../dailyPath';

export interface UpNextCardProps {
  view: StepView;
  /** "Step 3 of 5", or null for an extra beyond the path. */
  position: string | null;
  onStart: () => void;
  /** Skip the step for today; omitted for an extra. */
  onSkip?: () => void;
}

/** The one thing to do now: what it is, why it comes now, and the button that starts it. */
export function UpNextCard({ view, position, onStart, onSkip }: UpNextCardProps) {
  const { colors, spacing, radii } = useTheme();
  return (
    <View
      testID="up-next"
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.primary,
        borderWidth: 2,
        borderRadius: radii.lg,
        padding: spacing.lg,
        gap: spacing.sm,
      }}
    >
      <Text variant="label" color="primary">
        {position ? `Up next · ${position}` : 'If you have more time'}
      </Text>
      <Text variant="title">{view.title}</Text>
      <Text variant="bodyStrong">{view.detail}</Text>
      <Text color="textMuted">{view.why}</Text>
      {view.minutes !== null ? (
        <Text variant="caption" color="textMuted">{`About ${String(view.minutes)} min`}</Text>
      ) : null}
      <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
        <Button label={view.action} onPress={onStart} accessibilityHint={`Opens ${view.title}`} />
        {onSkip ? (
          <Button
            label="Skip for today"
            variant="secondary"
            size="compact"
            accessibilityHint={`Moves on without ${view.title} today`}
            onPress={onSkip}
          />
        ) : null}
      </View>
    </View>
  );
}
