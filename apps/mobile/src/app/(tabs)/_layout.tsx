import { NativeTabs } from 'expo-router/native-tabs';

import { useTheme } from '@/ui';

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <NativeTabs
      backgroundColor={colors.surface}
      indicatorColor={colors.track}
      // Label every tab, not only the selected one: five icons alone are
      // hard to tell apart for a new learner.
      labelVisibilityMode="labeled"
      labelStyle={{ default: { color: colors.textMuted }, selected: { color: colors.primary } }}
      iconColor={{ default: colors.textMuted, selected: colors.primary }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="sun.max" md="today" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="review">
        <NativeTabs.Trigger.Label>Review</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="rectangle.stack" md="style" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="read">
        <NativeTabs.Trigger.Label>Read</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="book" md="menu_book" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="speak">
        <NativeTabs.Trigger.Label>Speak</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="mic" md="mic" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="progress">
        <NativeTabs.Trigger.Label>Progress</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.bar" md="bar_chart" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
