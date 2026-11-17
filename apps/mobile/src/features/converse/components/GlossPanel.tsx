import { View } from 'react-native';

import { Button, Card, Text, useTheme } from '@/ui';

import type { WordGloss } from '../glossary';

/** The meaning of a tapped word. */
export function GlossPanel({
  word,
  gloss,
  onClose,
}: {
  word: string;
  gloss: WordGloss | null;
  onClose: () => void;
}) {
  const { spacing } = useTheme();
  return (
    <Card accessibilityLiveRegion="polite" testID="gloss-panel">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <Text variant="heading">{word}</Text>
          {gloss ? (
            <>
              {gloss.lemma.toLocaleLowerCase('it') !== word.toLocaleLowerCase('it') ? (
                <Text variant="caption" color="textMuted">{`from ${gloss.lemma}`}</Text>
              ) : null}
              <Text>{gloss.gloss}</Text>
              {gloss.source === 'tutor' ? (
                <Text variant="caption" color="textMuted">
                  Meaning given by the tutor
                </Text>
              ) : null}
            </>
          ) : (
            <Text color="textMuted">This word is not in the dictionary yet.</Text>
          )}
        </View>
        <Button label="Close" variant="secondary" onPress={onClose} />
      </View>
    </Card>
  );
}
