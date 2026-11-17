import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Chip, minTouchTarget, Text, useScreenReaderEnabled, useTheme } from '@/ui';

import type { ReaderSentence } from '../storyModel';

/** Props for {@link SentenceView}. */
export interface SentenceViewProps {
  sentence: ReaderSentence;
  /** This sentence is being played. */
  current: boolean;
  /** The token being spoken, when current. */
  wordIndex: number | null;
  /** Hidden until tapped (listening-first mode). */
  hidden: boolean;
  showTranslation: boolean;
  /** Lemmas the learner knows; other words are underlined. */
  known: ReadonlySet<number>;
  onWordPress: (sentenceIndex: number, tokenIndex: number) => void;
  onToggleTranslation: (sentenceIndex: number) => void;
  onReveal: (sentenceIndex: number) => void;
  onPlay: (sentenceIndex: number) => void;
}

/** The text of a sentence cut into one piece per token, with the text around it. */
function pieces(sentence: ReaderSentence) {
  const { it, tokens } = sentence;
  return tokens.map((t, i) => {
    const next = tokens[i + 1];
    return {
      before: i === 0 ? it.slice(0, t.start) : '',
      word: it.slice(t.start, t.end),
      after: it.slice(t.end, next ? next.start : it.length),
    };
  });
}

/**
 * One sentence of the story: tappable words (opening the word sheet), with
 * the spoken word highlighted while it plays. Tapping the sentence outside
 * its words shows its English with a play button and a hide toggle; those
 * buttons stay hidden otherwise so the story reads as text, not as a column
 * of buttons (a screen reader user always gets them). In listening-first
 * mode the text stays hidden until tapped.
 */
export const SentenceView = memo(function SentenceView({
  sentence,
  current,
  wordIndex,
  hidden,
  showTranslation,
  known,
  onWordPress,
  onToggleTranslation,
  onReveal,
  onPlay,
}: SentenceViewProps) {
  const { colors, spacing, radii, typography } = useTheme();
  const screenReader = useScreenReaderEnabled();
  const number = sentence.index + 1;
  const reading = {
    fontSize: typography.heading.fontSize,
    lineHeight: Math.round(typography.heading.fontSize * 1.5),
  };

  if (hidden) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Sentence ${String(number)}, hidden`}
        accessibilityHint="Shows the text of this sentence"
        accessibilityState={{ selected: current }}
        onPress={() => {
          onReveal(sentence.index);
        }}
        style={({ pressed }) => [
          styles.hidden,
          {
            borderRadius: radii.md,
            padding: spacing.md,
            borderColor: current ? colors.primary : colors.border,
            backgroundColor: pressed || current ? colors.track : colors.surface,
          },
        ]}
      >
        <Text color="textMuted">{`Sentence ${String(number)} · tap to show the text`}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessible={false}
      onPress={() => {
        onToggleTranslation(sentence.index);
      }}
      style={{
        borderRadius: radii.md,
        padding: spacing.sm,
        backgroundColor: current ? colors.track : 'transparent',
        gap: spacing.xs,
      }}
      testID={`sentence-${String(sentence.index)}`}
    >
      <View style={styles.words}>
        {pieces(sentence).map((p, i) => {
          const token = sentence.tokens[i];
          if (!token) return null;
          const spoken = current && wordIndex === i;
          const ids = token.lemmaId === null ? [] : [token.lemmaId, ...(token.partIds ?? [])];
          const unknown = token.isName !== true && ids.some((id) => !known.has(id));
          return (
            <Pressable
              key={`${String(token.start)}-${p.word}`}
              accessibilityRole="button"
              accessibilityLabel={p.word}
              accessibilityHint="Shows what this word means"
              accessibilityState={{ selected: spoken }}
              hitSlop={{ top: 5, bottom: 5, left: 2, right: 2 }}
              onPress={() => {
                onWordPress(sentence.index, i);
              }}
              style={{ paddingVertical: spacing.xs }}
            >
              {({ pressed }) => (
                <Text style={reading}>
                  {p.before}
                  <Text
                    style={[
                      reading,
                      {
                        color: spoken ? colors.onPrimary : colors.text,
                        backgroundColor: spoken
                          ? colors.primary
                          : pressed
                            ? colors.border
                            : 'transparent',
                        textDecorationLine: unknown ? 'underline' : 'none',
                        textDecorationColor: colors.textMuted,
                      },
                    ]}
                  >
                    {p.word}
                  </Text>
                  {p.after}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
      {showTranslation ? (
        <Text color="textMuted" accessibilityLabel={`Translation: ${sentence.en}`}>
          {sentence.en}
        </Text>
      ) : null}
      {showTranslation || screenReader ? (
        <View style={[styles.actions, { gap: spacing.sm }]}>
          <Button
            variant="secondary"
            size="compact"
            label="Play"
            accessibilityLabel={`Play sentence ${String(number)}`}
            onPress={() => {
              onPlay(sentence.index);
            }}
          />
          <Chip
            label={showTranslation ? 'Hide English' : 'English'}
            accessibilityLabel={
              showTranslation
                ? `Hide the translation of sentence ${String(number)}`
                : `Show the translation of sentence ${String(number)}`
            }
            selected={showTranslation}
            onPress={() => {
              onToggleTranslation(sentence.index);
            }}
          />
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  words: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' },
  actions: { flexDirection: 'row', flexWrap: 'wrap' },
  hidden: { borderWidth: 1, minHeight: minTouchTarget, justifyContent: 'center' },
});
