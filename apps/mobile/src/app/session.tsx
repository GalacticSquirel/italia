import { SessionProvider } from '@/features/session/SessionContext';
import { SessionScreen } from '@/features/session/SessionScreen';

export default function SessionRoute() {
  return (
    <SessionProvider>
      <SessionScreen />
    </SessionProvider>
  );
}
