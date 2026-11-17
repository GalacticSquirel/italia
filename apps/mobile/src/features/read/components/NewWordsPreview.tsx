import { useState } from 'react';
import { View } from 'react-native';

import type { LemmaRow } from '@/data';
import { sayItalian, useSpeech } from '@/speech';
import { Button, Card, Text, useTheme } from '@/ui';

/** Props for {@link NewWordsPreview}. */
export interface NewWordsPreviewProps {
  words: readonly LemmaRow[];
  speechRate: number;
  /** Add every previewed word to reviews; returns how many were added. */
  onAddAll: () => number;
}

/**
 * Optional pre-introduction of the story's new target words: a short list
 * with meanings and audio before reading, and a way to add them all to
 * reviews.
 */
export function NewWordsPreview({ words, speechRate, onAddAll }: NewWordsPreviewProps) {
  const { spacing } = useTheme();
  const services = useSpeech();
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState<number | null>(null);
  if (words.length === 0) return null;
  const count = `${String(words.length)} new ${words.length === 1 ? 'word' : 'words'}`;
  return (
    <Card>
      <Text variant="heading">{`This story teaches ${count}`}</Text>
      <Text color="textMuted">
        You can meet them now, or find them as you read: tap any word for its meaning.
      </Text>
      {open ? (
        <View style={{ gap: spacing.sm }}>
          {words.map((w) => (
            <View
              key={w.id}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
            >
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{w.lemma}</Text>
                <Text color="textMuted">{w.glossEn}</Text>
              </View>
              <Button
                variant="secondary"
                size="compact"
                label="Listen"
                accessibilityLabel={`Listen to ${w.lemma}`}
                onPress={() => {
                  void sayItalian(services, w.lemma, speechRate).catch(() => undefined);
                }}
              />
            </View>
          ))}
          {added === null ? (
            <Button
              label="Add all to reviews"
              variant="secondary"
              onPress={() => {
                setAdded(onAddAll());
              }}
            />
          ) : (
            <Text color="success" accessibilityLiveRegion="polite">
              {added === 0
                ? 'These words are already in your reviews.'
                : `Added ${String(added)} to your reviews.`}
            </Text>
          )}
        </View>
      ) : (
        <Button
          label="Preview the new words"
          variant="secondary"
          onPress={() => {
            setOpen(true);
          }}
        />
      )}
    </Card>
  );
}
