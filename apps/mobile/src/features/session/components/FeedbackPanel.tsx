import { useEffect } from 'react';
import { AccessibilityInfo, View } from 'react-native';

import type { GradeVerdict, Rating } from '@italia/core';

import type { Feedback } from '@/features/session/sessionStore';
import type { TypedPrompt } from '@/features/study/prompts';
import { answerHaptic } from '@/platform/haptics';
import { Button, Text, useTheme } from '@/ui';

import { DiffText } from './DiffText';
import { ListenButton } from './ListenButton';

/** Headline for each verdict. */
export const VERDICT_TEXT: Record<GradeVerdict, string> = {
  exact: 'Correct!',
  accent_only: 'Correct, but check the accents.',
  typo: 'Almost: correct with a small typo.',
  wrong: 'Not quite.',
};

const RATING_NAMES: Record<Rating, string> = {
  again: 'Again',
  hard: 'Hard',
  good: 'Good',
  easy: 'Easy',
};

/** `text` ending in a full stop, unless it already ends in punctuation. */
export const withStop = (text: string) => (/[.!?…]$/u.test(text) ? text : `${text}.`);

/** The full Italian sentence a prompt is about, for "listen" after answering. */
export function fullSentence(prompt: TypedPrompt): string {
  return prompt.kind === 'grammar_drill' ? prompt.drill.it : prompt.sentence.it;
}

export interface FeedbackPanelProps {
  prompt: TypedPrompt;
  feedback: Feedback;
  speechRate: number;
  autoPlay: boolean;
  onContinue: () => void;
  onOverride: () => void;
}

/** Feedback after a typed answer: verdict, diff, correct answer, override and continue. */
export function FeedbackPanel({
  prompt,
  feedback,
  speechRate,
  autoPlay,
  onContinue,
  onOverride,
}: FeedbackPanelProps) {
  const { colors, radii, spacing } = useTheme();
  const { grade } = feedback;
  const correct = grade.correct || feedback.overridden;
  const headline = feedback.overridden ? 'Counted as correct.' : VERDICT_TEXT[grade.verdict];
  const correctAnswer = withStop(`The correct answer is ${grade.matched}`);
  const announcement = correct
    ? `${headline}${grade.verdict === 'exact' ? '' : ` ${correctAnswer}`}`
    : `${headline} ${withStop(`You wrote ${feedback.answer}`)} ${correctAnswer}`;

  useEffect(() => {
    answerHaptic(grade.correct);
    AccessibilityInfo.announceForAccessibility(
      grade.correct
        ? VERDICT_TEXT[grade.verdict]
        : `${VERDICT_TEXT.wrong} ${withStop(`The correct answer is ${grade.matched}`)}`,
    );
  }, [grade]);

  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        gap: spacing.sm,
        padding: spacing.lg,
        borderRadius: radii.lg,
        backgroundColor: correct ? colors.successSurface : colors.dangerSurface,
      }}
    >
      <Text
        variant="heading"
        color={correct ? 'success' : 'danger'}
        accessibilityRole="alert"
        accessibilityLabel={announcement}
      >
        {headline}
      </Text>
      {grade.verdict !== 'exact' ? (
        <View style={{ gap: spacing.xxs }}>
          <Text variant="caption" color="textMuted">
            Your answer
          </Text>
          <DiffText diff={grade.diff} />
        </View>
      ) : null}
      <View
        accessible
        accessibilityLabel={`Correct answer: ${grade.matched}`}
        style={{ gap: spacing.xxs }}
      >
        <Text variant="caption" color="textMuted">
          Correct answer
        </Text>
        <Text variant="heading">{grade.matched}</Text>
      </View>
      {prompt.kind !== 'sentence_production' && prompt.kind !== 'dictation' ? (
        <Text color="textMuted">{fullSentence(prompt)}</Text>
      ) : null}
      <Text variant="caption" color="textMuted">
        {`Counted as ${RATING_NAMES[feedback.rating]}`}
      </Text>
      <ListenButton text={fullSentence(prompt)} rate={speechRate} autoPlay={autoPlay} />
      {!grade.correct && !feedback.overridden ? (
        <Button
          label="I was right"
          variant="secondary"
          accessibilityHint="Counts this answer as correct"
          onPress={onOverride}
        />
      ) : null}
      <Button label="Continue" onPress={onContinue} />
    </View>
  );
}
