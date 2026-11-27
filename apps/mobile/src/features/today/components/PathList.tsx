import { Pressable, StyleSheet, View } from 'react-native';

import { minTouchTarget, Text, useTheme } from '@/ui';

import type { StepView } from '../dailyPath';

export interface PathListProps {
  steps: readonly StepView[];
  /** Open a step: the current one, or a finished or skipped one to do again. */
  onOpen: (step: StepView) => void;
}

const STATUS_LABEL = {
  done: 'done',
  skipped: 'skipped',
  current: 'up next',
  upcoming: 'later',
} as const;

/** The day's steps in order, with what is done, skipped, next and still to come. */
export function PathList({ steps, onOpen }: PathListProps) {
  const { colors, spacing, radii } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radii.lg,
        overflow: 'hidden',
      }}
      accessibilityRole="list"
      testID="path-list"
    >
      {steps.map((view, i) => {
        const step = view.step;
        if (!step) return null;
        const { status } = step;
        const finished = status === 'done' || status === 'skipped';
        const current = status === 'current';
        const pressable = status !== 'upcoming';
        const marker = status === 'done' ? '✓' : status === 'skipped' ? '–' : String(i + 1);
        return (
          <Pressable
            key={step.id}
            disabled={!pressable}
            onPress={() => {
              onOpen(view);
            }}
            accessibilityRole={pressable ? 'button' : undefined}
            accessibilityLabel={`Step ${String(i + 1)}, ${view.title}, ${view.detail}, ${STATUS_LABEL[status]}`}
            accessibilityHint={current ? view.action : finished ? 'Opens it again' : undefined}
            testID={`path-step-${step.id}`}
            style={({ pressed }) => [
              styles.row,
              {
                gap: spacing.md,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.border,
                backgroundColor: pressed
                  ? colors.track
                  : current
                    ? colors.primarySurface
                    : 'transparent',
              },
            ]}
          >
            <View
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
              style={[
                styles.marker,
                {
                  width: spacing.xxl,
                  height: spacing.xxl,
                  borderRadius: radii.pill,
                  backgroundColor: status === 'done' ? colors.primary : 'transparent',
                  borderColor: current || status === 'done' ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                variant="label"
                color={status === 'done' ? 'onPrimary' : current ? 'primary' : 'textMuted'}
              >
                {marker}
              </Text>
            </View>
            <View style={[styles.text, { gap: spacing.xxs }]}>
              <Text
                variant="bodyStrong"
                color={status === 'upcoming' || status === 'skipped' ? 'textMuted' : 'text'}
              >
                {view.title}
              </Text>
              <Text variant="caption" color="textMuted">
                {status === 'skipped'
                  ? 'Skipped today'
                  : view.minutes !== null && !finished
                    ? `${view.detail} · about ${String(view.minutes)} min`
                    : view.detail}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: minTouchTarget },
  marker: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
});
