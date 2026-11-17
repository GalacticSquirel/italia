import { View } from 'react-native';

import type { RecognitionPrompt } from '@/features/study/prompts';
import { Button, Card, Text, useTheme } from '@/ui';

import { ListenButton } from './ListenButton';

export interface RecognitionCardProps {
  prompt: RecognitionPrompt;
  speechRate: number;
  autoPlay: boolean;
  onGotIt: () => void;
}

const POS_NAMES: Record<string, string> = {
  NOUN: 'noun',
  VERB: 'verb',
  AUX: 'verb',
  ADJ: 'adjective',
  ADV: 'adverb',
  PRON: 'pronoun',
  DET: 'article',
  ADP: 'preposition',
  CCONJ: 'conjunction',
  SCONJ: 'conjunction',
  NUM: 'number',
  INTJ: 'interjection',
  PROPN: 'name',
};

/** Readable part of speech for a Universal POS tag. */
export const posName = (pos: string) => POS_NAMES[pos] ?? pos.toLowerCase();

/** First exposure to a new word: the word, its meaning, an example and audio. */
export function RecognitionCard({ prompt, speechRate, autoPlay, onGotIt }: RecognitionCardProps) {
  const { spacing } = useTheme();
  const { lemma, example } = prompt;
  return (
    <View style={{ gap: spacing.lg }}>
      <Card>
        <Text variant="caption" color="textMuted">
          New word
        </Text>
        <Text variant="display">{lemma.lemma}</Text>
        <Text color="textMuted">{posName(lemma.pos)}</Text>
        <Text variant="heading">{lemma.glossEn}</Text>
        {example ? (
          <View style={{ gap: spacing.xxs, marginTop: spacing.sm }}>
            <Text variant="bodyStrong">{example.it}</Text>
            <Text color="textMuted">{example.en}</Text>
          </View>
        ) : null}
      </Card>
      <ListenButton
        text={example ? `${lemma.lemma}. ${example.it}` : lemma.lemma}
        rate={speechRate}
        autoPlay={autoPlay}
      />
      <Button label="Got it" onPress={onGotIt} accessibilityHint="Moves to the next item" />
    </View>
  );
}
