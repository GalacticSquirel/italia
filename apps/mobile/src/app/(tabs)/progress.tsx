import { EmptyState, Screen } from '@/ui';

export default function ProgressScreen() {
  return (
    <Screen title="Progress">
      <EmptyState
        title="No progress yet"
        message="Words known, hours studied and your estimated level will appear here once you start."
      />
    </Screen>
  );
}
