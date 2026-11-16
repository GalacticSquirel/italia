import { View } from 'react-native';

import { currentItem, currentOutcome } from '@/features/speak/drill/drillMachine';
import type { DrillRunner } from '@/features/speak/drill/useDrillRunner';
import { Button, Card, ProgressBar, Text, useTheme } from '@/ui';

import { PronunciationResult } from './PronunciationResult';

export interface DrillViewProps {
  runner: DrillRunner;
  /** Label of the skip action (in a study session: "Type instead"). */
  skipLabel?: string;
  /** Label of the continue action after the last item. */
  finishLabel?: string;
}

const RATING_TEXT = {
  again: 'Not this time',
  hard: 'Right, with some effort',
  good: 'Right',
  easy: 'Right, and quick',
} as const;

/** The prompt, pause, answer drill for the current item. */
export function DrillView({ runner, skipLabel = 'Skip', finishLabel = 'Finish' }: DrillViewProps) {
  const { spacing } = useTheme();
  const { state } = runner;
  const item = currentItem(state);
  if (!item) return null;
  const outcome = currentOutcome(state);
  const last = state.last;
  const isLast = state.index === state.items.length - 1;
  const showAnswer = state.phase === 'answer' || state.phase === 'feedback';

  return (
    <View style={{ gap: spacing.lg }} testID="drill-view">
      <Card>
        <Text variant="caption" color="textMuted">
          Say it in Italian
        </Text>
        <Text variant="title" accessibilityLabel={`English: ${item.cue}`}>
          {item.cue}
        </Text>
        {showAnswer ? (
          <Text variant="heading" color="primary" accessibilityLabel={`Italian: ${item.answer}`}>
            {item.answer}
          </Text>
        ) : null}
      </Card>

      {state.phase === 'ready' ? (
        <Button label="Start" onPress={runner.start} accessibilityHint="Plays the English cue" />
      ) : null}

      {state.phase === 'cue' ? (
        <Text color="textMuted" accessibilityLiveRegion="polite">
          Listen…
        </Text>
      ) : null}

      {state.phase === 'listening' ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="bodyStrong" accessibilityLiveRegion="polite">
            {state.attempt === 2 ? 'Try once more: speak now' : 'Speak now'}
          </Text>
          <ProgressBar value={runner.level} label="Microphone level" />
          {state.error === null ? (
            <Button
              label="Done"
              onPress={runner.finishAnswer}
              accessibilityHint="Stops recording and checks your answer"
            />
          ) : (
            <>
              <Text color="danger" accessibilityLiveRegion="polite">
                {state.error}
              </Text>
              <Button label="Try again" onPress={runner.listenAgain} />
            </>
          )}
        </View>
      ) : null}

      {state.phase === 'transcribing' ? (
        <Text color="textMuted" accessibilityLiveRegion="polite">
          Checking…
        </Text>
      ) : null}

      {state.phase === 'retry' ? (
        <Text variant="bodyStrong" color="warning" accessibilityLiveRegion="polite">
          {`Not quite (I heard “${last?.transcript ?? ''}”). Try once more.`}
        </Text>
      ) : null}

      {showAnswer && outcome && last ? (
        <View style={{ gap: spacing.md }}>
          <Text
            variant="bodyStrong"
            color={outcome.rating === 'again' ? 'danger' : 'success'}
            accessibilityLiveRegion="polite"
          >
            {RATING_TEXT[outcome.rating]}
          </Text>
          <Text color="textMuted">{`I heard: “${last.transcript}”`}</Text>
          <PronunciationResult analysis={runner.analysis} scorerReady={runner.scorerReady} />
          {state.phase === 'feedback' ? (
            <View style={{ gap: spacing.sm }}>
              <Button label={isLast ? finishLabel : 'Next'} onPress={runner.next} />
              <Button label="Hear it again" variant="secondary" onPress={runner.replayAnswer} />
            </View>
          ) : null}
        </View>
      ) : null}

      {!showAnswer ? <Button label={skipLabel} variant="secondary" onPress={runner.skip} /> : null}
    </View>
  );
}
