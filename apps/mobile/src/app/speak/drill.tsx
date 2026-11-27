import { useLocalSearchParams } from 'expo-router';

import { DrillScreen } from '@/features/speak/DrillScreen';
import { closeStep } from '@/features/today/navigation';

export default function DrillRoute() {
  const { handsFree } = useLocalSearchParams<{ handsFree?: string }>();
  return <DrillScreen handsFree={handsFree === '1'} onClose={closeStep} />;
}
