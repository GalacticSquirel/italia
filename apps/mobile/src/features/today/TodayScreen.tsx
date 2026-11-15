import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Card, EmptyState, ProgressBar, Screen, Stat, Text, useTheme } from '@/ui';

import { days, freezesText, streakMessage } from './streakCopy';
import { useTodayPlan, type TodaySummary } from './useTodayPlan';

const LIMIT_NOTES = {
  daily_limit: null,
  low_accuracy: 'Fewer new words today: recent accuracy is under 80%, so reviews come first.',
  review_load: 'New words are held back so the coming week of reviews fits your time budget.',
  time_budget: "Today's time budget is full, so some new material waits until tomorrow.",
} as const;

function emptyMessage(s: TodaySummary): { title: string; message: string } {
  if (s.wordsAvailable === 0) {
    return {
      title: 'All caught up',
      message:
        'Nothing is due and you have met every word available. Reviews will appear here as they come due.',
    };
  }
  return {
    title: 'Done for today',
    message:
      "You have learned today's new words and nothing is due. Come back tomorrow, or raise the daily limit in Settings.",
  };
}

/** The Today tab: today's plan, the streak and the start button. */
export function TodayScreen() {
  const { summary } = useTodayPlan();
  const { spacing } = useTheme();
  const { streak } = summary;
  const minutesToday = Math.round(streak.todayMinutes);
  const notes = [
    ...summary.limitedBy.map((r) => LIMIT_NOTES[r]).filter((n): n is NonNullable<typeof n> => !!n),
    ...(summary.deferredReviews > 0
      ? [`${String(summary.deferredReviews)} more reviews will wait for another session.`]
      : []),
  ];
  const empty = emptyMessage(summary);

  return (
    <Screen title="Today">
      {summary.items > 0 ? (
        <Card>
          <Text variant="heading">Today&apos;s session</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
            <Stat label="Reviews due" value={String(summary.reviews)} />
            <Stat label="New words" value={String(summary.newWords)} />
            <Stat label="About" value={`${String(summary.estimatedMinutes)} min`} />
          </View>
          {summary.newPractice > 0 ? (
            <Text color="textMuted">
              Plus {String(summary.newPractice)} new sentence and grammar{' '}
              {summary.newPractice === 1 ? 'item' : 'items'}.
            </Text>
          ) : null}
          {notes.map((n) => (
            <Text key={n} variant="caption" color="textMuted">
              {n}
            </Text>
          ))}
          <View style={{ marginTop: spacing.sm }}>
            <Button
              label="Start session"
              accessibilityHint="Opens today's study session"
              onPress={() => {
                router.push('/session');
              }}
            />
          </View>
        </Card>
      ) : (
        <EmptyState title={empty.title} message={empty.message} />
      )}

      <Card>
        <Text variant="heading">Streak</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
          <Stat
            label="Current streak"
            value={days(streak.currentDays)}
            caption={freezesText(streak.freezesAvailable) ?? undefined}
          />
          <Stat label="This week" value={`${String(Math.round(summary.weekMinutes))} min`} />
        </View>
        <Text>{streakMessage(streak)}</Text>
        <ProgressBar
          value={minutesToday / summary.minutesBudget}
          label={`Studied today: ${String(minutesToday)} of ${String(summary.minutesBudget)} minutes`}
        />
        <Text variant="caption" color="textMuted">
          {`Today: ${String(minutesToday)} of ${String(summary.minutesBudget)} minutes`}
        </Text>
      </Card>

      <Button
        label="Settings"
        variant="secondary"
        onPress={() => {
          router.push('/settings');
        }}
      />
    </Screen>
  );
}
