import { EmptyState, Screen } from '@/ui';

export default function SpeakScreen() {
  return (
    <Screen title="Speak">
      <EmptyState
        title="No speaking practice yet"
        message="Prompt-and-answer drills, ear training and shadowing will appear here."
      />
    </Screen>
  );
}
