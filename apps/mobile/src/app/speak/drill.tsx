import { router, useLocalSearchParams } from 'expo-router';

import { DrillScreen } from '@/features/speak/DrillScreen';

export default function DrillRoute() {
  const { handsFree } = useLocalSearchParams<{ handsFree?: string }>();
  return (
    <DrillScreen
      handsFree={handsFree === '1'}
      onClose={() => {
        router.back();
      }}
    />
  );
}
