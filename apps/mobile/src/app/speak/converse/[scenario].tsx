import { router, useLocalSearchParams } from 'expo-router';

import { ConversationScreen } from '@/features/converse/ConversationScreen';

export default function ConversationRoute() {
  const { scenario } = useLocalSearchParams<{ scenario: string }>();
  return (
    <ConversationScreen
      scenarioId={scenario}
      onClose={() => {
        router.back();
      }}
    />
  );
}
