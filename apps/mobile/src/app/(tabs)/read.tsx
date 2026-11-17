import { EmptyState, Screen } from '@/ui';

export default function ReadScreen() {
  return (
    <Screen title="Read">
      <EmptyState
        title="No stories yet"
        message="Graded stories at your level will appear here, with audio and tap-to-translate."
      />
    </Screen>
  );
}
