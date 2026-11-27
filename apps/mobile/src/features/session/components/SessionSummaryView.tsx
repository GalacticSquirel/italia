import { View } from 'react-native';

import type { StreakEvent } from '@italia/core';

import type { SessionSummary } from '@/features/session/sessionStore';
import { NextStepHandoff } from '@/features/today/components/NextStepHandoff';
import { days, streakMessage } from '@/features/today/streakCopy';
import { Card, Stat, Text, useTheme } from '@/ui';

/** One line about a streak event, or null for events not worth a line. */
export function streakEventText(event: StreakEvent): string | null {
  switch (event.type) {
    case 'day_counted':
      return 'Today counts towards your streak.';
    case 'freeze_earned':
      return 'You earned a streak freeze.';
    case 'freeze_used':
      return `A freeze covered ${event.date}.`;
    case 'repaired':
      return `Streak repaired: ${days(event.restoredDays)}.`;
    case 'repair_offered':
      return `Do a double session by ${event.expiresOn} to repair your streak.`;
    case 'streak_reset':
    case 'repair_expired':
      return null;
  }
}

export interface SessionSummaryViewProps {
  summary: SessionSummary;
  onDone: () => void;
}

/** End of a session: accuracy, words learned, minutes, the streak and the next step of the day. */
export function SessionSummaryView({ summary, onDone }: SessionSummaryViewProps) {
  const { spacing } = useTheme();
  const lines = [...new Set(summary.streakEvents.map(streakEventText).filter((l) => l !== null))];
  const minutes = Math.max(1, Math.round(summary.minutes));
  return (
    <View style={{ gap: spacing.lg }}>
      <Text variant="title" accessibilityRole="header">
        Session complete
      </Text>
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
          <Stat
            label="Accuracy"
            value={
              summary.accuracy === null ? '–' : `${String(Math.round(summary.accuracy * 100))}%`
            }
          />
          <Stat label="New words" value={String(summary.newWords)} />
          <Stat label="Reviews" value={String(summary.reviews)} />
          <Stat label="Minutes" value={String(minutes)} />
        </View>
      </Card>
      <Card>
        <Text variant="heading">{`Streak: ${days(summary.streak.currentDays)}`}</Text>
        {lines.map((l) => (
          <Text key={l}>{l}</Text>
        ))}
        <Text color="textMuted">{streakMessage(summary.streak)}</Text>
      </Card>
      <NextStepHandoff onDone={onDone} at={summary.finishedAt} />
    </View>
  );
}
