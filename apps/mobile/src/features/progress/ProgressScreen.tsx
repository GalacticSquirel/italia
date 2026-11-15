import { View } from 'react-native';

import { BarChart, Card, Screen, Stat, Text, useTheme } from '@/ui';

import type { CalendarDay, ProgressData } from './progressData';
import { useProgress } from './useProgress';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** Hours as "0.5 h" or "12 h". */
export function formatHours(hours: number): string {
  return `${String(hours < 10 ? Math.round(hours * 10) / 10 : Math.round(hours))} h`;
}

/** The CEFR estimate as text, with its range when the range is wider than one level. */
export function cefrText(cefr: ProgressData['cefr']): string {
  return cefr.range.low === cefr.range.high
    ? cefr.level
    : `${cefr.level} (range ${cefr.range.low} to ${cefr.range.high})`;
}

function loadBars(data: ProgressData) {
  return data.load.map((d) => {
    const date = new Date(data.now.getTime() + d.day * 86_400_000);
    const label = d.day === 0 ? 'Today' : (WEEKDAYS[date.getDay()] ?? '');
    const name = d.day === 0 ? 'Today' : (WEEKDAY_NAMES[date.getDay()] ?? '');
    return {
      label,
      value: d.reviews,
      accessibilityLabel: `${name}: ${String(d.reviews)} ${d.reviews === 1 ? 'review' : 'reviews'}, about ${String(Math.ceil(d.seconds / 60))} minutes`,
    };
  });
}

function StudyCalendar({ days }: { days: readonly CalendarDay[] }) {
  const { colors, radii, spacing } = useTheme();
  const studied = days.filter((d) => d.minutes > 0).length;
  return (
    <View style={{ gap: spacing.sm }}>
      <Text color="textMuted">{`Studied on ${String(studied)} of the last ${String(days.length)} days.`}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {days.map((d, i) => {
          const isToday = i === days.length - 1;
          const minutes = Math.round(d.minutes);
          return (
            <View
              key={d.date}
              accessible
              accessibilityLabel={`${d.date}${isToday ? ', today' : ''}: ${minutes > 0 ? `${String(minutes)} minutes` : d.minutes > 0 ? 'under a minute' : 'no study'}`}
              style={{
                width: 32,
                height: 32,
                borderRadius: radii.sm,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: d.minutes > 0 ? colors.primary : colors.track,
                borderWidth: isToday ? 2 : 0,
                borderColor: colors.focus,
              }}
            >
              <Text variant="caption" color={d.minutes > 0 ? 'onPrimary' : 'textMuted'}>
                {String(Number(d.date.slice(8)))}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** The Progress tab: words known, hours, CEFR estimate, review load and the study calendar. */
export function ProgressScreen() {
  const data = useProgress();
  const { spacing } = useTheme();
  const { cefr, projection } = data;
  return (
    <Screen title="Progress">
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
          <Stat label="Words known" value={String(data.knownWords)} />
          <Stat label="Hours studied" value={formatHours(data.hours)} />
        </View>
        <Text variant="caption" color="textMuted">
          A word counts as known when you would very likely recall it today and it has held for at
          least a week.
        </Text>
      </Card>

      <Card>
        <Text variant="heading">Estimated level</Text>
        <Stat label="CEFR estimate" value={cefrText(cefr)} />
        {cefr.nextLevel ? (
          <Text>{`${String(cefr.lemmasToNextLevel)} more known words to reach ${cefr.nextLevel} vocabulary.`}</Text>
        ) : null}
        <Text color="textMuted">
          {projection
            ? `At your recent pace, about ${formatHours(projection.hours)} of study to ${projection.nextLevel}.`
            : 'Study for a few hours to see a projection of the time to your next level.'}
        </Text>
        <Text variant="caption" color="textMuted">
          An estimate from vocabulary and grammar only; speaking will refine it later.
        </Text>
      </Card>

      <Card>
        <Text variant="heading">Reviews this week</Text>
        <BarChart title="Forecast reviews for the next seven days" data={loadBars(data)} />
      </Card>

      <Card>
        <Text variant="heading">Last 30 days</Text>
        <StudyCalendar days={data.calendar} />
      </Card>
    </Screen>
  );
}
