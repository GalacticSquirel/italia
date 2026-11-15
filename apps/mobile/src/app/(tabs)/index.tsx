import { router } from 'expo-router';

import { Button, EmptyState, ProgressBar, Screen } from '@/ui';

export default function TodayScreen() {
  return (
    <Screen title="Today">
      <ProgressBar value={0} label="Today's session" />
      <EmptyState
        title="No session yet"
        message="Your daily session of reviews, new words, a story and speaking practice will appear here."
      />
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
