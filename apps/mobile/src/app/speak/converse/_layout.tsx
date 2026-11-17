import { Stack } from 'expo-router';

import { TutorProvider } from '@/tutor';

/** Conversation routes share one tutor, freed when they close. */
export default function ConverseLayout() {
  return (
    <TutorProvider>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Conversation' }} />
        <Stack.Screen name="[scenario]" options={{ title: 'Conversation' }} />
      </Stack>
    </TutorProvider>
  );
}
