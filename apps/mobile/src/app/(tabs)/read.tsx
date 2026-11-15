import { EmptyState, Screen } from '@/ui';

export default function ReadScreen() {
  return (
    <Screen title="Read">
      <EmptyState
        title="Coming in a later phase"
        message="Graded stories at your level, with audio, a synced transcript and tap-to-translate, arrive in a later phase. Your daily session already uses real example sentences."
      />
    </Screen>
  );
}
