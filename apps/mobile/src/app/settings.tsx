import { EmptyState, Screen } from '@/ui';

export default function SettingsScreen() {
  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <EmptyState
        title="No settings yet"
        message="Daily time budget, new-word limit, voices and appearance will be configurable here."
      />
    </Screen>
  );
}
