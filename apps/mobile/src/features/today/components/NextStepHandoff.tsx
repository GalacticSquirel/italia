import { View } from 'react-native';

import { Button, Card, Text, useTheme } from '@/ui';

import { openStep } from '../navigation';
import { useTodayOnMount } from '../useToday';

export interface NextStepHandoffProps {
  /** Leave the finished step (back to Today, or wherever it was opened from). */
  onDone: () => void;
  /** When the step finished; defaults to now. */
  at?: Date;
}

/**
 * Shown at the end of a step: hands the learner straight to the next step of
 * today's path, or says the day is done. Mount it once the step is recorded.
 */
export function NextStepHandoff({ onDone, at }: NextStepHandoffProps) {
  const { spacing } = useTheme();
  const state = useTodayOnMount(at);
  if (state.status === 'error') {
    return <Button label="Done" onPress={onDone} />;
  }
  const { next, path, extra } = state.data;
  if (!next) {
    return (
      <View style={{ gap: spacing.sm }} testID="handoff">
        <Card>
          <Text variant="heading">{"Today's path is complete"}</Text>
          <Text color="textMuted">
            {extra
              ? `Well done. If you have more time: ${extra.title.toLowerCase()}.`
              : 'Well done. Come back tomorrow for the next step.'}
          </Text>
        </Card>
        <Button label="Back to Today" onPress={onDone} />
      </View>
    );
  }
  const index = path.steps.findIndex((s) => s.id === next.step?.id);
  return (
    <View style={{ gap: spacing.sm }} testID="handoff">
      <Card>
        <Text variant="label" color="primary">
          {`Next · step ${String(index + 1)} of ${String(path.steps.length)}`}
        </Text>
        <Text variant="heading">{next.title}</Text>
        <Text color="textMuted">
          {next.minutes !== null
            ? `${next.detail} · about ${String(next.minutes)} min`
            : next.detail}
        </Text>
      </Card>
      <Button
        label={`Continue: ${next.title}`}
        onPress={() => {
          openStep(next.target, 'replace');
        }}
      />
      <Button label="Take a break" variant="secondary" onPress={onDone} />
    </View>
  );
}
