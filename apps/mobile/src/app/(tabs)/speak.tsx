import { EmptyState, Screen } from '@/ui';

export default function SpeakScreen() {
  return (
    <Screen title="Speak">
      <EmptyState
        title="Coming in a later phase"
        message="Speaking drills (prompt, pause, answer), ear training and shadowing arrive with on-device speech recognition. For now, practise with the audio in your daily session."
      />
    </Screen>
  );
}
