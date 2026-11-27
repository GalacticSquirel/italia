import { useLocalSearchParams } from 'expo-router';

import { SessionProvider } from '@/features/session/SessionContext';
import { SessionScreen } from '@/features/session/SessionScreen';

export default function SessionRoute() {
  const { part } = useLocalSearchParams<{ part?: string }>();
  return (
    <SessionProvider part={part === 'reviews' ? 'reviews' : 'learn'}>
      <SessionScreen />
    </SessionProvider>
  );
}
