import { EmptyState, Screen } from '@/ui';

export default function ReviewScreen() {
  return (
    <Screen title="Review">
      <EmptyState
        title="Nothing to review"
        message="Cards you have learned come back here when they are due."
      />
    </Screen>
  );
}
