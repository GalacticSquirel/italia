import { View } from 'react-native';

import { diffStrings, ERROR_TAG_BY_ID, type TutorAnnotations } from '@italia/core';

import { DiffText } from '@/features/session/components/DiffText';
import { Text, useTheme } from '@/ui';

const labels = (tags: readonly string[]) =>
  tags.map((t) => ERROR_TAG_BY_ID.get(t)?.label ?? t).join(', ');

/**
 * The tutor's feedback on the learner's last message: a recast shows what the
 * learner wrote against the corrected form; a prompt points at the part to
 * fix without giving the answer away.
 */
export function CorrectionView({ annotations }: { annotations: TutorAnnotations }) {
  const { colors, radii, spacing } = useTheme();
  const { prompt, recast } = annotations;
  if (recast === null && prompt === null) return null;
  const box = {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  };
  if (recast !== null) {
    return (
      <View
        style={box}
        accessible
        accessibilityLabel={`Correction: you wrote ${recast.learnerText}; better: ${recast.correctedText}. ${labels(recast.errorTags)}.`}
        testID="recast"
      >
        <Text variant="caption" color="textMuted">
          {`Correction · ${labels(recast.errorTags)}`}
        </Text>
        <DiffText diff={diffStrings(recast.learnerText, recast.correctedText)} />
        <Text color="textMuted">{`You wrote “${recast.learnerText}”`}</Text>
        <Text variant="label" color="success">{`Better: “${recast.correctedText}”`}</Text>
      </View>
    );
  }
  if (prompt === null) return null;
  return (
    <View
      style={box}
      accessible
      accessibilityLabel={`Have another look at ${prompt.learnerText}: ${labels(prompt.errorTags)}.`}
      testID="prompt-hint"
    >
      <Text variant="caption" color="textMuted">
        {`Have another look · ${labels(prompt.errorTags)}`}
      </Text>
      <Text variant="label">{`“${prompt.learnerText}”`}</Text>
    </View>
  );
}
