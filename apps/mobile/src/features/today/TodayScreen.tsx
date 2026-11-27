import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Card, EmptyState, Screen, Text, useTheme } from '@/ui';

import { DayProgress } from './components/DayProgress';
import { PathList } from './components/PathList';
import { UpNextCard } from './components/UpNextCard';
import type { TodayData } from './dailyPath';
import { openStep } from './navigation';
import { days, freezesText, streakMessage } from './streakCopy';
import { useToday } from './useToday';

/** "2 of 5 steps done · about 21 min left", or a line for a finished day. */
function summaryLine({ path, minutesLeft, streak }: TodayData): string {
  const total = path.steps.length;
  if (path.next === null) {
    return `All ${String(total)} steps done · ${String(Math.round(streak.todayMinutes))} min today`;
  }
  return `${String(path.finished)} of ${String(total)} steps done · about ${String(minutesLeft)} min left`;
}

function DayComplete({ data }: { data: TodayData }) {
  const { colors, radii, spacing } = useTheme();
  return (
    <View
      testID="day-complete"
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: colors.successSurface,
        borderRadius: radii.lg,
        padding: spacing.lg,
        gap: spacing.sm,
      }}
    >
      <Text variant="title">Day complete</Text>
      <Text>
        {data.extra
          ? 'Every step of today is done. Extra practice below is a bonus.'
          : 'Every step of today is done. Come back tomorrow for the next part of your path.'}
      </Text>
    </View>
  );
}

function Today({
  data,
  onSkip,
}: {
  data: TodayData;
  onSkip: (view: TodayData['steps'][number]) => void;
}) {
  const { spacing } = useTheme();
  const { next, extra, path, streak } = data;
  const position = next?.step
    ? `step ${String(path.steps.indexOf(next.step) + 1)} of ${String(path.steps.length)}`
    : null;
  const freezes = freezesText(streak.freezesAvailable);
  return (
    <>
      <View style={{ gap: spacing.sm }}>
        <Text color="textMuted">{summaryLine(data)}</Text>
        <DayProgress steps={path.steps} />
      </View>

      {next ? (
        <UpNextCard
          view={next}
          position={position}
          onStart={() => {
            openStep(next.target);
          }}
          onSkip={() => {
            onSkip(next);
          }}
        />
      ) : (
        <DayComplete data={data} />
      )}
      {!next && extra ? (
        <UpNextCard
          view={extra}
          position={null}
          onStart={() => {
            openStep(extra.target);
          }}
        />
      ) : null}
      {next?.activity === 'learn_session'
        ? data.notes.map((n) => (
            <Text key={n} variant="caption" color="textMuted">
              {n}
            </Text>
          ))
        : null}

      <View style={{ gap: spacing.sm }}>
        <Text variant="heading">{"Today's path"}</Text>
        <PathList
          steps={data.steps}
          onOpen={(view) => {
            openStep(view.target);
          }}
        />
      </View>

      {data.unlocks.length > 0 ? (
        <Card testID="unlocks">
          <Text variant="heading">Coming to your path</Text>
          {data.unlocks.map((u) => (
            <View key={u.key} style={{ gap: spacing.sm }}>
              <Text color="textMuted">{u.text}</Text>
              {u.action ? (
                <Button
                  label={u.action.label}
                  variant="secondary"
                  onPress={() => {
                    router.push(u.action?.pathname ?? '/models');
                  }}
                />
              ) : null}
            </View>
          ))}
        </Card>
      ) : null}

      <Card testID="streak">
        <Text variant="heading">{`Streak: ${days(streak.currentDays)}`}</Text>
        <Text>{streakMessage(streak)}</Text>
        <Text variant="caption" color="textMuted">
          {[`${String(Math.round(data.weekMinutes))} min studied this week`, freezes]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </Card>
    </>
  );
}

/** The Today tab: today's path, with the one step to do now at the top. */
export function TodayScreen() {
  const { state, refresh, skip } = useToday();
  return (
    <Screen
      title="Today"
      headerAction={
        <Button
          label="Settings"
          variant="secondary"
          size="compact"
          onPress={() => {
            router.push('/settings');
          }}
        />
      }
    >
      {state.status === 'error' ? (
        <EmptyState
          title="Today's path could not load"
          message={`Your progress is safe. ${state.message}`}
          action={<Button label="Try again" onPress={refresh} />}
        />
      ) : (
        <Today
          data={state.data}
          onSkip={(view) => {
            if (view.step) skip(view.step.id);
          }}
        />
      )}
    </Screen>
  );
}
