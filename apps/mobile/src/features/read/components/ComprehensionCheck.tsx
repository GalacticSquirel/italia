import { useState } from 'react';
import { View } from 'react-native';

import type { ComprehensionQuestion } from '@italia/core';

import { Button, Card, Text, useTheme } from '@/ui';

/** Props for {@link ComprehensionCheck}. */
export interface ComprehensionCheckProps {
  questions: readonly ComprehensionQuestion[];
  /** Called after the last item with the number answered correctly. */
  onDone: (correct: number, total: number) => void;
  /** Leave the check without a result. */
  onSkip: () => void;
}

function Prompt({ question }: { question: ComprehensionQuestion }) {
  if (question.kind === 'cloze') {
    return (
      <>
        <Text color="textMuted">Which word completes the sentence from the story?</Text>
        <Text
          variant="heading"
          accessibilityLabel={`${question.before} blank ${question.after}`}
        >{`${question.before}_____${question.after}`}</Text>
      </>
    );
  }
  return (
    <>
      <Text color="textMuted">Does this sentence from the story mean the following?</Text>
      <Text variant="heading">{question.it}</Text>
      <Text>{`“${question.claim}”`}</Text>
    </>
  );
}

/**
 * The end-of-story check, one item at a time: cloze items (choose the missing
 * word) and a true/false item on a sentence's meaning, with the correct answer
 * and translation after each answer.
 */
export function ComprehensionCheck({ questions, onDone, onSkip }: ComprehensionCheckProps) {
  const { spacing } = useTheme();
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null);
  const question = questions[index];
  if (!question) return null;

  const right =
    answer === null
      ? null
      : question.kind === 'cloze'
        ? answer === question.answer
        : (answer === 'yes') === question.answer;
  const choose = (value: string) => {
    if (answer !== null) return;
    setAnswer(value);
    const ok =
      question.kind === 'cloze' ? value === question.answer : (value === 'yes') === question.answer;
    if (ok) setCorrect((n) => n + 1);
  };
  const options =
    question.kind === 'cloze'
      ? question.options.map((o) => ({ value: o, label: o }))
      : [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
        ];
  const last = index === questions.length - 1;

  return (
    <Card testID="comprehension-check">
      <Text variant="caption" color="textMuted">
        {`Check your understanding · ${String(index + 1)} of ${String(questions.length)}`}
      </Text>
      <Prompt question={question} />
      <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
        {options.map((o) => (
          <Button
            key={o.value}
            label={o.label}
            variant={answer === o.value ? 'primary' : 'secondary'}
            accessibilityState={{ selected: answer === o.value, disabled: answer !== null }}
            onPress={() => {
              choose(o.value);
            }}
          />
        ))}
      </View>
      {right === null ? null : (
        <View accessibilityLiveRegion="polite" style={{ gap: spacing.xs }}>
          <Text variant="bodyStrong" color={right ? 'success' : 'danger'}>
            {right
              ? 'Correct.'
              : question.kind === 'cloze'
                ? `Not quite: the story says “${question.answer}”.`
                : `Not quite: the answer is ${question.answer ? 'yes' : 'no'}.`}
          </Text>
          <Text color="textMuted">{question.translation}</Text>
        </View>
      )}
      <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
        {answer === null ? (
          <Button label="Skip the check" variant="secondary" onPress={onSkip} />
        ) : (
          <Button
            label={last ? 'See result' : 'Next'}
            onPress={() => {
              if (last) {
                onDone(correct, questions.length);
                return;
              }
              setIndex((i) => i + 1);
              setAnswer(null);
            }}
          />
        )}
      </View>
    </Card>
  );
}
