import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/**
 * The time the screen was last focused. Screens derive their data from it,
 * so data read from the database refreshes whenever the screen comes back
 * into view (for example after a session or a settings change).
 */
export function useFocusNow(): [Date, () => void] {
  const [now, setNow] = useState(() => new Date());
  const refresh = useCallback(() => {
    setNow(new Date());
  }, []);
  useFocusEffect(refresh);
  return [now, refresh];
}
