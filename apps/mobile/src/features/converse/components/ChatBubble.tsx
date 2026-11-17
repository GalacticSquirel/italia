import { View } from 'react-native';

import type { TutorOutput } from '@italia/core';

import { Text, useTheme } from '@/ui';

import { splitWords } from '../glossary';
import { CorrectionView } from './CorrectionView';

/** A tutor reply: every word can be tapped for its meaning. */
export function TutorBubble({
  text,
  output,
  onWord,
  streaming = false,
}: {
  text: string;
  output?: TutorOutput;
  onWord: (word: string) => void;
  streaming?: boolean;
}) {
  const { colors, radii, spacing } = useTheme();
  return (
    <View style={{ alignSelf: 'flex-start', maxWidth: '90%', gap: spacing.xs }}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radii.lg,
          padding: spacing.md,
        }}
        accessibilityLabel={`Tutor: ${text}`}
        accessibilityHint="Tap a word to see what it means"
        accessibilityLiveRegion={streaming ? 'polite' : 'none'}
      >
        <Text>
          {splitWords(text).map((piece, i) =>
            piece.word ? (
              <Text
                key={i}
                accessibilityRole="link"
                onPress={() => {
                  onWord(piece.text);
                }}
              >
                {piece.text}
              </Text>
            ) : (
              piece.text
            ),
          )}
          {streaming ? '…' : ''}
        </Text>
      </View>
      {output ? <CorrectionView annotations={output.annotations} /> : null}
    </View>
  );
}

/** The learner's message. */
export function LearnerBubble({ text }: { text: string }) {
  const { colors, radii, spacing } = useTheme();
  return (
    <View
      style={{
        alignSelf: 'flex-end',
        maxWidth: '85%',
        backgroundColor: colors.primary,
        borderRadius: radii.lg,
        padding: spacing.md,
      }}
      accessibilityLabel={`You: ${text}`}
    >
      <Text color="onPrimary">{text}</Text>
    </View>
  );
}
