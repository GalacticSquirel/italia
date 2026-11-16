import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AddToReviewsResult } from '@/data';
import { posName } from '@/features/session/components/RecognitionCard';
import { sayItalian, useSpeech } from '@/speech';
import { Button, Text, useTheme } from '@/ui';

import type { WordInfo } from '../wordInfo';

/** Props for {@link WordSheet}. */
export interface WordSheetProps {
  /** The word to show; the sheet is closed when null. */
  word: WordInfo | null;
  /** The sentence the word was tapped in (Italian), for context audio. */
  sentence: string | null;
  speechRate: number;
  onAddToReviews: (lemmaId: number) => AddToReviewsResult | 'unavailable';
  onOpenWord?: (lemmaId: number) => void;
  onClose: () => void;
}

const ADDED_MESSAGES: Record<AddToReviewsResult | 'unavailable', string> = {
  added: 'Added. It comes up in your next session.',
  restored: 'Back in your reviews.',
  already: 'Already in your reviews.',
  unavailable: 'This word has no practice sentence yet.',
};

/** One line describing the word's form, e.g. "ha: a form of avere" or "nel: in + il". */
function formLine(word: WordInfo): string | null {
  if (!word.lemma) return null;
  if (word.parts.length > 0) {
    return `${word.form} = ${[word.lemma, ...word.parts].map((l) => l.lemma).join(' + ')}`;
  }
  if (word.form.toLocaleLowerCase('it') === word.lemma.lemma.toLocaleLowerCase('it')) return null;
  return `“${word.form}” is a form of “${word.lemma.lemma}”`;
}

function memoryLine(word: WordInfo): string {
  const met =
    word.exposures === 0
      ? 'Not met in finished stories yet'
      : `Met ${String(word.exposures)} ${word.exposures === 1 ? 'time' : 'times'} in stories`;
  if (word.known) return `You know this word · ${met}`;
  if (word.review === 'active') return `In your reviews · ${met}`;
  return met;
}

/**
 * Bottom sheet for a tapped word: dictionary form, meaning, form details, an
 * example sentence, audio, and "Add to reviews".
 */
export function WordSheet({
  word,
  sentence,
  speechRate,
  onAddToReviews,
  onOpenWord,
  onClose,
}: WordSheetProps) {
  const { colors, radii, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const services = useSpeech();
  const [message, setMessage] = useState<{ form: string; text: string } | null>(null);
  const visible = word !== null;
  const lemma = word?.lemma ?? null;
  const shownMessage = message !== null && message.form === word?.form ? message.text : null;

  const say = (text: string) => {
    void sayItalian(services, text, speechRate).catch(() => undefined);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close word details"
          onPress={onClose}
          style={[styles.backdrop, { backgroundColor: colors.background, opacity: 0.8 }]}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderTopLeftRadius: radii.lg,
              borderTopRightRadius: radii.lg,
              paddingBottom: insets.bottom + spacing.lg,
            },
          ]}
          testID="word-sheet"
        >
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
            {word === null ? null : lemma === null ? (
              <>
                <Text variant="title">{word.form}</Text>
                <Text color="textMuted">
                  {word.isName
                    ? 'A name (of a person or a place). Names are not counted as words to learn.'
                    : 'This word is not in the dictionary yet.'}
                </Text>
              </>
            ) : (
              <>
                <View style={{ gap: spacing.xxs }}>
                  <Text variant="title">{lemma.lemma}</Text>
                  <Text color="textMuted">{posName(lemma.pos)}</Text>
                </View>
                <Text variant="heading">{lemma.glossEn}</Text>
                {formLine(word) ? <Text>{formLine(word)}</Text> : null}
                {word.parts.length > 0 ? (
                  <Text color="textMuted">
                    {word.parts.map((p) => `${p.lemma}: ${p.glossEn}`).join(' · ')}
                  </Text>
                ) : null}
                <Text variant="caption" color={word.known ? 'success' : 'textMuted'}>
                  {memoryLine(word)}
                </Text>
                <View style={[styles.row, { gap: spacing.sm }]}>
                  <Button
                    label="Listen"
                    variant="secondary"
                    accessibilityLabel={`Listen to ${lemma.lemma}`}
                    onPress={() => {
                      say(lemma.lemma);
                    }}
                  />
                  {sentence ? (
                    <Button
                      label="Sentence"
                      variant="secondary"
                      accessibilityLabel="Listen to the sentence"
                      onPress={() => {
                        say(sentence);
                      }}
                    />
                  ) : null}
                </View>
                {word.example ? (
                  <View style={{ gap: spacing.xxs }}>
                    <Text variant="caption" color="textMuted">
                      Example
                    </Text>
                    <Text variant="bodyStrong">{word.example.it}</Text>
                    <Text color="textMuted">{word.example.en}</Text>
                  </View>
                ) : null}
                {word.review === 'active' ? (
                  <Text color="success" accessibilityLiveRegion="polite">
                    {shownMessage ?? 'In your reviews.'}
                  </Text>
                ) : (
                  <Button
                    label={word.review === 'suspended' ? 'Restore to reviews' : 'Add to reviews'}
                    disabled={word.review === 'unavailable'}
                    accessibilityHint="Practise this word in your sessions"
                    onPress={() => {
                      const result = onAddToReviews(lemma.id);
                      setMessage({ form: word.form, text: ADDED_MESSAGES[result] });
                    }}
                  />
                )}
                {word.review === 'unavailable' ? (
                  <Text variant="caption" color="textMuted">
                    {ADDED_MESSAGES.unavailable}
                  </Text>
                ) : null}
                {onOpenWord ? (
                  <Button
                    label="Word details"
                    variant="secondary"
                    onPress={() => {
                      onOpenWord(lemma.id);
                    }}
                  />
                ) : null}
              </>
            )}
            <Button label="Close" variant="secondary" onPress={onClose} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: { maxHeight: '80%', borderWidth: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
});
